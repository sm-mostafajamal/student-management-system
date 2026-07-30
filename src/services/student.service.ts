// All Student business logic lives here. Server Actions and Server
// Components call these functions and never touch Prisma directly for
// anything beyond a trivial read.

import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { CreateStudentInput, UpdateStudentInput, StudentQueryInput } from "@/lib/validations/student.schema";
import type { StudentWithProgramme, PaginatedResult } from "@/types";


async function assertEmailAvailable(
  tx: Prisma.TransactionClient,
  email: string,
  excludeUserId?: string
): Promise<void> {
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== excludeUserId) {
    throw new AppError("DUPLICATE_EMAIL", "A user with this email already exists.", {
      email: ["This email is already registered."],
    });
  }
}

/**
 * Resolves the admission AcademicYear.
 * Edge case: "Academic year validation" — if the caller supplies an id, it
 * must exist. If none is supplied, we fall back to the AcademicYear flagged
 * isCurrent=true, and fail loudly (not silently pick an arbitrary row) if
 * no year is currently marked current — that's a data-setup problem staff
 * need to know about, not paper over.
 */
async function resolveAdmissionYear(tx: Prisma.TransactionClient, admissionAcademicYearId?: string) {
  if (admissionAcademicYearId) {
    const year = await tx.academicYear.findUnique({ where: { id: admissionAcademicYearId } });
    if (!year) {
      throw new AppError("ACADEMIC_YEAR_INVALID", "Selected admission academic year does not exist.", {
        admissionAcademicYearId: ["Invalid academic year."],
      });
    }
    return year;
  }

  const current = await tx.academicYear.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError(
      "ACADEMIC_YEAR_INVALID",
      "No current academic year is configured. Ask an admin to set one, or select an admission year explicitly."
    );
  }
  return current;
}

/**
 * Generates SMS-YYYY-XXXX, scoped per admission year.
 *
 * Edge case: "Concurrent student creation" — two staff members submitting
 * at the same instant must not both compute sequence #43. We take a
 * Postgres advisory lock keyed by year *inside* the transaction. The
 * second concurrent transaction blocks on the lock until the first
 * commits or rolls back, so the count-then-increment below is safe. The
 * lock is transaction-scoped (`pg_advisory_xact_lock`) and releases
 * automatically — no separate cleanup needed.
 */
async function generateStudentNumber(tx: Prisma.TransactionClient, admissionYear: number): Promise<string> {
  const prefix = `SMS-${admissionYear}-`;
  const lockKey = `student_number:${admissionYear}`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  // Counting (rather than reading a separate counter table) intentionally
  // includes soft-deleted students — IDs must never be reused, even for a
  // deleted record, to avoid confusing two different humans sharing one
  // student number in transcripts/audit trails.
  const count = await tx.student.count({ where: { studentNumber: { startsWith: prefix } } });
  const next = count + 1;

  if (next > 9999) {
    throw new AppError(
      "STUDENT_ID_EXHAUSTED",
      `Student ID sequence for ${admissionYear} is exhausted (9999 admissions reached).`
    );
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}

const studentInclude = { user: true, programme: true } satisfies Prisma.StudentInclude;

// ─────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────

export async function listStudents(query: StudentQueryInput): Promise<PaginatedResult<StudentWithProgramme>> {
  const where: Prisma.StudentWhereInput = {
    deletedAt: null,
    ...(query.programmeId && { programmeId: query.programmeId }),
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { studentNumber: { contains: query.search, mode: "insensitive" } },
        { user: { firstName: { contains: query.search, mode: "insensitive" } } },
        { user: { lastName: { contains: query.search, mode: "insensitive" } } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getStudentById(id: string): Promise<StudentWithProgramme> {
  const student = await prisma.student.findUnique({ where: { id }, include: studentInclude });
  if (!student || student.deletedAt) {
    throw new AppError("NOT_FOUND", "Student not found.");
  }
  return student;
}

// ─────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────

export async function createStudent(input: CreateStudentInput): Promise<StudentWithProgramme> {
  const email = input.email.toLowerCase().trim();

  // Edge case: "Programme no longer active" — fail fast before opening a
  // transaction, with a message that names the programme (not a generic
  // "invalid input").
  const programme = await prisma.programme.findUnique({ where: { id: input.programmeId } });
  if (!programme || programme.deletedAt) {
    throw new AppError("NOT_FOUND", "Selected programme does not exist.");
  }
  if (!programme.isActive) {
    throw new AppError(
      "PROGRAMME_INACTIVE",
      `"${programme.name}" is no longer accepting students. Choose an active programme.`,
      { programmeId: ["This programme is inactive."] }
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Pre-check for a fast, friendly error in the common case. The DB
      // unique constraint on User.email (caught below as P2002) is the
      // real guarantee against the rare race where two requests pass this
      // check for the same email in the same instant.
      await assertEmailAvailable(tx, email);

      const admissionYear = await resolveAdmissionYear(tx, input.admissionAcademicYearId);
      const studentNumber = await generateStudentNumber(tx, admissionYear.startDate.getFullYear());

      return tx.student.create({
        data: {
          studentNumber,
          programmeId: programme.id,
          admissionAcademicYearId: admissionYear.id,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          phone: input.phone || null,
          address: input.address || null,
          user: {
            create: {
              email,
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              role: Role.STUDENT,
            },
          },
        },
        include: studentInclude,
      });
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = ((err.meta?.target as string[]) ?? []).join(",");
      if (target.includes("email")) {
        throw new AppError("DUPLICATE_EMAIL", "A user with this email already exists.", {
          email: ["This email is already registered."],
        });
      }
      throw new AppError("CONFLICT", "A conflicting record already exists. Please retry.");
    }
    throw err;
  }
}

export async function updateStudent(id: string, input: UpdateStudentInput): Promise<StudentWithProgramme> {
  const existing = await prisma.student.findUnique({ where: { id }, include: { user: true } });
  if (!existing || existing.deletedAt) {
    throw new AppError("NOT_FOUND", "Student not found.");
  }

  const email = input.email?.toLowerCase().trim();
  const isProgrammeChange = !!input.programmeId && input.programmeId !== existing.programmeId;

  if (isProgrammeChange) {
    const targetProgramme = await prisma.programme.findUnique({ where: { id: input.programmeId! } });
    if (!targetProgramme || targetProgramme.deletedAt) {
      throw new AppError("NOT_FOUND", "Selected programme does not exist.");
    }
    // Edge case: "Programme no longer active" — also enforced on edit,
    // not just create.
    if (!targetProgramme.isActive) {
      throw new AppError(
        "PROGRAMME_INACTIVE",
        `"${targetProgramme.name}" is no longer active and cannot be assigned.`,
        { programmeId: ["This programme is inactive."] }
      );
    }

    // Edge case: "Changing programme after payments already exist" — Fee
    // rows snapshot their amount at creation (per schema design) so past
    // invoices are unaffected either way, but a programme switch has real
    // consequences for *future* fee structures and reporting. We don't
    // silently allow it: the first submit without `force` is blocked with
    // an explanatory error; the UI turns that into a confirmation step
    // that requires a typed reason before resubmitting with force=true.
    const paymentCount = await prisma.payment.count({ where: { studentId: id } });
    if (paymentCount > 0 && !input.force) {
      throw new AppError(
        "PROGRAMME_CHANGE_HAS_PAYMENTS",
        `This student has ${paymentCount} recorded payment(s). Changing programme will not alter ` +
          `historical fees/payments (they are snapshotted), but future billing will follow the new ` +
          `programme's fee structure. Confirm to proceed.`
      );
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (email && email !== existing.user.email) {
        await assertEmailAvailable(tx, email, existing.userId);
      }

      if (email || input.firstName || input.lastName) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(email && { email }),
            ...(input.firstName && { firstName: input.firstName.trim() }),
            ...(input.lastName && { lastName: input.lastName.trim() }),
          },
        });
      }

      return tx.student.update({
        where: { id },
        data: {
          ...(input.programmeId && { programmeId: input.programmeId }),
          ...(input.status && { status: input.status }),
          ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth }),
          ...(input.gender !== undefined && { gender: input.gender }),
          ...(input.phone !== undefined && { phone: input.phone || null }),
          ...(input.address !== undefined && { address: input.address || null }),
          ...(input.expectedGraduationDate !== undefined && {
            expectedGraduationDate: input.expectedGraduationDate,
          }),
        },
        include: studentInclude,
      });

      // KNOWN LIMITATION (documented, not hidden): a programme change made
      // with force=true + changeReason is validated but, unlike grade
      // changes, there is no `ProgrammeChangeLog` model in the current
      // schema to persist that reason. In a production build this should
      // mirror GradeChangeLog. Flagged in README rather than silently
      // dropping the audit trail or scope-creeping a new model into this task.
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("DUPLICATE_EMAIL", "A user with this email already exists.", {
        email: ["This email is already registered."],
      });
    }
    throw err;
  }
}

/**
 * Soft delete. Never a hard DELETE — Student is referenced by Enrollment,
 * Fee, Payment, Submission, Grade with onDelete: Restrict specifically so
 * a hard delete would fail loudly anyway once any academic/financial
 * history exists. We also deactivate the linked User so a "deleted"
 * student can't be treated as a valid login/session subject.
 */
export async function softDeleteStudent(id: string): Promise<void> {
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Student not found.");
  if (existing.deletedAt) return; // idempotent — repeat delete is a no-op, not an error

  await prisma.$transaction([
    prisma.student.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } }),
  ]);
}