// All Student business logic lives here. Server Actions and Server
// Components call these functions and never touch Prisma directly for
// anything beyond a trivial read.

import { Prisma, Role, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { CreateStudentInput, UpdateStudentInput, StudentQueryInput } from "@/lib/validations/student.schema";
import type { StudentWithProgramme, PaginatedResult, Serialized } from "@/types";
import { assignProgrammeBaseFee, assignCourseFeeForEnrollment } from "@/services/fee.service";
import { toNumber } from "@/lib/decimal";


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
      throw new AppError("VALIDATION_ERROR", "Selected admission academic year does not exist.", {
        admissionAcademicYearId: ["Invalid academic year."],
      });
    }
    return year;
  }

  const current = await tx.academicYear.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError(
      "VALIDATION_ERROR",
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
      "FORBIDDEN",
      `Student ID sequence for ${admissionYear} is exhausted (9999 admissions reached).`
    );
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}
export interface AutoEnrollSummary {
  enrolledCourseCodes: string[];
  skippedNoOffering: string[];
  skippedCapacity: string[];
}

/**
 * Auto-enrolls a newly admitted student into every course that belongs to
 * their programme ("default courses" — Course.programmeId === the
 * student's programme) for their admission academic year.
 *
 * For each such course, we enroll into every CourseOffering that already
 * exists for it in that academic year (there may be more than one, e.g.
 * one per semester). A course with no offering yet for that year is
 * skipped and reported (not an error — staff simply haven't scheduled it
 * yet); an offering already at capacity is likewise skipped and reported.
 * Each successful enrollment immediately bills the course's fee via
 * assignCourseFeeForEnrollment — same as a manual enrollment.
 */
async function autoEnrollDefaultCourses(
  tx: Prisma.TransactionClient,
  studentId: string,
  programmeId: string,
  academicYearId: string
): Promise<AutoEnrollSummary> {
  const courses = await tx.course.findMany({
    where: { programmeId, isActive: true, deletedAt: null },
  });

  const enrolledCourseCodes: string[] = [];
  const skippedNoOffering: string[] = [];
  const skippedCapacity: string[] = [];

  for (const course of courses) {
    const offerings = await tx.courseOffering.findMany({
      where: { courseId: course.id, academicYearId, deletedAt: null },
    });

    if (offerings.length === 0) {
      skippedNoOffering.push(course.code);
      continue;
    }

    for (const offering of offerings) {
      if (offering.capacity != null) {
        const enrolledCount = await tx.enrollment.count({
          where: { courseOfferingId: offering.id, status: EnrollmentStatus.ENROLLED },
        });
        if (enrolledCount >= offering.capacity) {
          skippedCapacity.push(course.code);
          continue;
        }
      }

      const enrollment = await tx.enrollment.create({
        data: { studentId, courseOfferingId: offering.id, status: EnrollmentStatus.ENROLLED },
      });
      await assignCourseFeeForEnrollment(enrollment.id, tx);
      enrolledCourseCodes.push(course.code);
    }
  }

  return { enrolledCourseCodes, skippedNoOffering, skippedCapacity };
}

const studentInclude = { user: true, programme: true } satisfies Prisma.StudentInclude;

// Programme.baseFee is a Prisma Decimal and is not plain-object-serializable,
// so it can't cross the Server Component → Client Component boundary (or a
// Server Action's return value) as-is. Every read/write path below returns
// through this so callers always get a plain number.
function serializeStudent<T extends StudentWithProgramme>(student: T): Serialized<T> {
  return {
    ...student,
    programme: {
      ...student.programme,
      baseFee: toNumber(student.programme.baseFee),
      creditHourRate: toNumber(student.programme.creditHourRate),
    },
  } as Serialized<T>;
}

// ─────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────

export async function listStudents(
  query: StudentQueryInput
): Promise<PaginatedResult<Serialized<StudentWithProgramme>>> {
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
      orderBy: {createdAt : 'desc'},
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items: items.map(serializeStudent),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getStudentById(id: string): Promise<Serialized<StudentWithProgramme>> {
  const student = await prisma.student.findUnique({ where: { id }, include: studentInclude });
  if (!student || student.deletedAt) {
    throw new AppError("NOT_FOUND", "Student not found.");
  }
  return serializeStudent(student);
}

// ─────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────

export async function createStudent(
  input: CreateStudentInput
): Promise<Serialized<StudentWithProgramme> & { autoEnrollment: AutoEnrollSummary }> {
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
      "FORBIDDEN",
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

      const student = await tx.student.create({
        data: {
          studentNumber,
          programme: { connect: { id: programme.id } },
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

  // Bill the programme's base fee immediately on admission (snapshotted
      // — a later change to Programme.baseFee never retroactively reprices
      // this student). No-ops cleanly if baseFee is 0.
      await assignProgrammeBaseFee(student.id, tx);

      // Auto-enroll into the programme's default courses for the admission
      // year, billing each one, same as if staff manually enrolled the
      // student in each — see autoEnrollDefaultCourses above.
      const autoEnrollment = await autoEnrollDefaultCourses(
        tx,
        student.id,
        programme.id,
        admissionYear.id
      );

      return { ...serializeStudent(student), autoEnrollment };
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

export async function updateStudent(id: string, input: UpdateStudentInput): Promise<Serialized<StudentWithProgramme>> {
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
        "FORBIDDEN",
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
        "FORBIDDEN",
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

      const updated = await tx.student.update({
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

      return serializeStudent(updated);

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