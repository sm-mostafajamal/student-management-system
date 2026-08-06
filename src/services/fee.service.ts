/**
 * Fee & Payment domain service.
 *
 * Key design decisions documented here:
 *
 * 1. amountPaid is NOT a column on Fee — it's always computed as
 *    SUM(payments WHERE status = COMPLETED). This prevents the Fee row
 *    and its child Payments from ever disagreeing.
 *
 * 2. Fee.amountDue is a SNAPSHOT taken at creation time. Changing the
 *    FeeStructure template never retroactively alters an already-issued Fee.
 *
 * 3. Payment reversal uses status = REVERSED, never DELETE. Financial audit
 *    trails must be immutable.
 *
 * 4. Payment.reference is an idempotency key — duplicate submissions are
 *    rejected at the DB constraint level before any money logic runs.
 */
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { ok, fail, assertFound, AppError } from "@/lib/errors";
import { toNumberRequired, toNumber } from "@/lib/decimal";
import type {
  ApiResult,
  FeeBalance,
  StudentFinancialSummary,
  FeeWithPayments,
} from "@/types";
import {
  FeeStatus,
  PaymentStatus,
  Semester,
  FeeCategory,
} from "@prisma/client";
import { z } from "zod";

export class FeeAssignmentError extends Error {}
// ─── Validation schemas ───────────────────────────────────────────────────────

export const WaiveFeeSchema = z.object({
  waivedAmount: z.number().positive(),
  waivedReason: z.string().min(10).max(500),
});

/**
 * Bills ONE student for every active FeeStructure matching their programme
 * for the given year/semester.
 *
 * Idempotent by construction: relies on the Fee_studentId_feeStructureId_key
 * unique constraint. Re-running this for a student who's already billed for
 * some categories silently skips those and only creates the missing ones —
 * safe to call again after a partial failure or a double-click.
 */
export async function assignFeesForStudent(
  studentId: string,
  academicYearId: string,
  semester: Semester
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId, deletedAt: null },
    select: { id: true, programmeId: true },
  });
  if (!student) {
    throw new FeeAssignmentError("Student not found or has been removed.");
  }

  const structures = await prisma.feeStructure.findMany({
    where: { programmeId: student.programmeId, academicYearId, semester, isActive: true },
  });
  if (structures.length === 0) {
    throw new FeeAssignmentError(
      "No active fee structure is defined for this student's programme in the selected year/semester. Create one first."
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const structure of structures) {
    try {
      const fee = await prisma.fee.create({
        data: {
          studentId,
          feeStructureId: structure.id,
          academicYearId,
          semester,
          category: structure.category,
          amountDue: structure.amount, // snapshot at billing time — see rationale above
          status: "PENDING",
        },
      });
      created.push(fee.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        skipped.push(structure.category); // already billed for this category — not an error
        continue;
      }
      throw err;
    }
  }

  return { created: created.length, skipped };
}

/**
 * Bills every active, non-deleted student in a programme. Uses allSettled
 * so one bad row never blocks billing the rest of the cohort — Registry
 * needs a report of failures, not an all-or-nothing rollback.
 */
export async function bulkAssignFeesForProgramme(
  programmeId: string,
  academicYearId: string,
  semester: Semester
) {
  const students = await prisma.student.findMany({
    where: { programmeId, deletedAt: null, status: "ENROLLED" },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    students.map((s) => assignFeesForStudent(s.id, academicYearId, semester))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results
    .map((r, i) => (r.status === "rejected" ? { studentId: students[i].id, reason: String(r.reason) } : null))
    .filter((x): x is { studentId: string; reason: string } => x !== null);

  return { totalStudents: students.length, succeeded, failed };
}

// ─── Programme base fee & per-course fee billing ──────────────────────────────
//
// "What a student actually owes" = Programme.baseFee (billed once) + the
// courseFee of every course they're enrolled in (billed once per
// Enrollment). Both are SNAPSHOTTED into a Fee row at billing time, using
// the exact same discipline as the FeeStructure→Fee flow above: an
// already-billed student is never retroactively repriced just because the
// programme/course catalog changes later.
//
// The running total ("Total Fee Assigned") and outstanding balance are
// never stored — they're always the live sum of a student's Fee rows minus
// their live payments (see getStudentFinancialSummary / getStudentFeeBreakdown),
// so a newly added course or a newly recorded payment is reflected
// immediately with nothing to resync.

/**
 * Bills a student ONCE for their programme's base fee. Safe to call
 * multiple times (e.g. re-run after a partial failure) — a second call is
 * a no-op because a Fee for this (student, PROGRAMME_FEE) pair already
 * exists. Skips silently if baseFee is 0 (nothing owed, nothing to bill).
 */
export async function assignProgrammeBaseFee(
  studentId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ApiResult<{ created: boolean }>> {
  try {
    const student = await tx.student.findUnique({
      where: { id: studentId, deletedAt: null },
      include: { programme: true },
    });
    assertFound(student, "Student");

    const baseFee = toNumberRequired(student.programme.baseFee);
    if (baseFee <= 0) return ok({ created: false });

    const existing = await tx.fee.findFirst({
      where: { studentId, category: FeeCategory.PROGRAMME_FEE },
      select: { id: true },
    });
    if (existing) return ok({ created: false });

    const academicYearId =
      student.admissionAcademicYearId ??
      (await tx.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
    if (!academicYearId) {
      throw new FeeAssignmentError(
        "Cannot bill the programme fee: student has no admission year and no academic year is marked current."
      );
    }

    await tx.fee.create({
      data: {
        studentId,
        academicYearId,
        semester: Semester.FIRST_SEMESTER,
        category: FeeCategory.PROGRAMME_FEE,
        amountDue: student.programme.baseFee, // snapshot
        dueDate: addDays(new Date(), 30),
      },
    });

    return ok({ created: true });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    if (err instanceof FeeAssignmentError) return fail(err.message);
    console.error("[FeeService.assignProgrammeBaseFee]", err);
    return fail("Failed to bill the programme base fee");
  }
}

/**
 * Bills the course's fee for one Enrollment, snapshotting Course.courseFee
 * at enrollment time. Idempotent via the Fee_enrollmentId_key unique
 * constraint — re-running this (e.g. a student re-enrolling after a drop)
 * silently no-ops if a Fee already exists for this Enrollment. Skips
 * entirely if the course's fee is 0 (e.g. a free elective).
 */
export async function assignCourseFeeForEnrollment(
  enrollmentId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ApiResult<{ created: boolean }>> {
  try {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        courseOffering: { include: { course: true, academicYear: true } },
        student: { include: { programme: true } },
      },
    });
    assertFound(enrollment, "Enrollment");

    // "Amount per course by credit hour": if the ENROLLING student's
    // programme has a creditHourRate configured, the course fee is
    // computed as creditHours * creditHourRate for that student, rather
    // than the course's own flat courseFee. This matters for cross-listed
    // courses (Course.programmeId can be null or differ from the
    // student's own programme) — the rate that applies is always the
    // rate of the programme the STUDENT is billed under.
    // Falls back to the course's flat courseFee when no rate is set (0),
    // so programmes/courses with no rate configured are unaffected.
    const creditHourRate = toNumberRequired(enrollment.student.programme.creditHourRate);
    const computedFee =
      creditHourRate > 0
        ? enrollment.courseOffering.course.creditHours * creditHourRate
        : toNumberRequired(enrollment.courseOffering.course.courseFee);

    if (computedFee <= 0) return ok({ created: false });

    try {
      await tx.fee.create({
        data: {
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          academicYearId: enrollment.courseOffering.academicYearId,
          semester: enrollment.courseOffering.semester,
          category: FeeCategory.COURSE_FEE,
          amountDue: computedFee, // snapshot — computed once, never recomputed later
          dueDate: addDays(new Date(), 30),
        },
      });
      return ok({ created: true });
    } catch (err) {
      // Already billed for this enrollment (re-enroll after a drop, or a
      // double-submitted request) — not an error, just a no-op.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return ok({ created: false });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[FeeService.assignCourseFeeForEnrollment]", err);
    return fail("Failed to bill the course fee");
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * The full "what does this student owe and why" breakdown for the student
 * detail page: programme base fee, every enrolled course with its
 * individual fee, full payment history per line item, and the live
 * outstanding balance. Nothing here is stored — it's assembled fresh from
 * Fee + Payment + Enrollment on every call.
 */
export async function getStudentFeeBreakdown(studentId: string) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId, deletedAt: null },
      include: { programme: true, user: true },
    });
    assertFound(student, "Student");

    const [fees, enrollments] = await Promise.all([
      prisma.fee.findMany({
        where: { studentId },
        include: { payments: { orderBy: { paidAt: "desc" } } },
        orderBy: [{ category: "asc" }, { createdAt: "desc" }],
      }),
      prisma.enrollment.findMany({
        where: { studentId },
        include: { courseOffering: { include: { course: true } } },
        orderBy: { enrolledAt: "desc" },
      }),
    ]);

    const feeLines = fees.map((fee) => {
      const amountDue = toNumberRequired(fee.amountDue);
      const waivedAmount = toNumberRequired(fee.waivedAmount);
      const totalPaid = fee.payments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .reduce((sum, p) => sum + toNumberRequired(p.amount), 0);
      const balance = amountDue - waivedAmount - totalPaid;
      return {
        fee,
        amountDue,
        waivedAmount,
        totalPaid,
        balance,
        isOverdue: fee.dueDate != null && fee.dueDate < new Date() && balance > 0,
        // The Enrollment (if this is a COURSE_FEE line) may have since been
        // dropped — the Fee and its payment history still show, per the
        // "deferred/withdrawn students keep historical fees" requirement.
        course: enrollments.find((e) => e.id === fee.enrollmentId)?.courseOffering.course ?? null,
      };
    });

    const totalOwed = feeLines.reduce((s, l) => s + l.amountDue, 0);
    const totalWaived = feeLines.reduce((s, l) => s + l.waivedAmount, 0);
    const totalPaid = feeLines.reduce((s, l) => s + l.totalPaid, 0);
    const outstandingBalance = totalOwed - totalWaived - totalPaid;

    const programmeFeeLine = feeLines.find((l) => l.fee.category === FeeCategory.PROGRAMME_FEE) ?? null;
    const courseFeeLines = feeLines.filter((l) => l.fee.category === FeeCategory.COURSE_FEE);
    const otherFeeLines = feeLines.filter(
      (l) => l.fee.category !== FeeCategory.PROGRAMME_FEE && l.fee.category !== FeeCategory.COURSE_FEE
    );

    // Courses the student is enrolled in but that haven't been billed yet
    // (e.g. free elective, courseFee=0, or billing hasn't run) — still
    // worth listing so staff see the full course load, not just charges.
    const enrolledCourses = enrollments
      .filter((e) => e.status === "ENROLLED")
      .map((e) => ({
        enrollment: e,
        course: e.courseOffering.course,
        feeLine: feeLines.find((l) => l.fee.enrollmentId === e.id) ?? null,
      }));

    return ok({
      student,
      programme: student.programme,
      baseFee: toNumberRequired(student.programme.baseFee),
      programmeFeeLine,
      courseFeeLines,
      otherFeeLines,
      enrolledCourses,
      totalOwed,
      totalWaived,
      totalPaid,
      outstandingBalance,
      hasOverdueFees: feeLines.some((l) => l.isOverdue),
      isOverdueMoreThan30Days: feeLines.some(
        (l) => l.isOverdue && l.fee.dueDate != null && l.fee.dueDate < addDays(new Date(), -30)
      ),
    });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[FeeService.getStudentFeeBreakdown]", err);
    return fail("Failed to build student fee breakdown");
  }
}

// ─── Balance computation ──────────────────────────────────────────────────────

/**
 * Computes the live balance for a single fee.
 * This is the source of truth — never use Fee.status alone for exact amounts.
 */
export async function computeFeeBalance(
  feeId: string
): Promise<ApiResult<FeeBalance>> {
  try {
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: {
        payments: {
          where: { status: PaymentStatus.COMPLETED },
        },
      },
    });
    assertFound(fee, "Fee");

    const amountDue = toNumberRequired(fee.amountDue);
    const waivedAmount = toNumberRequired(fee.waivedAmount);
    const totalPaid = fee.payments.reduce(
      (sum, p) => sum + toNumberRequired(p.amount),
      0
    );
    // Deliberately NOT clamped to 0 — a negative balance is a real credit
    // (overpayment) that the UI should surface, not hide.
    const balance = amountDue - waivedAmount - totalPaid;
    const isOverdue =
      fee.dueDate != null && fee.dueDate < new Date() && balance > 0;

    return ok({
      feeId,
      amountDue,
      waivedAmount,
      totalPaid,
      balance,
      status: fee.status,
      isOverdue,
    });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[FeeService.computeFeeBalance]", err);
    return fail("Failed to compute fee balance");
  }
}

/**
 * Computes the financial summary for a student across all fees.
 */
export async function getStudentFinancialSummary(
  studentId: string
): Promise<ApiResult<StudentFinancialSummary>> {
  try {
    const fees = await prisma.fee.findMany({
      where: { studentId },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
      },
    });

    let totalOwed = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let hasOverdueFees = false;

    for (const fee of fees) {
      const amountDue = toNumberRequired(fee.amountDue);
      const waivedAmount = toNumberRequired(fee.waivedAmount);
      const paid = fee.payments.reduce(
        (sum, p) => sum + toNumberRequired(p.amount),
        0
      );

      totalOwed += amountDue;
      totalWaived += waivedAmount;
      totalPaid += paid;

      const balance = amountDue - waivedAmount - paid;
      if (balance > 0 && fee.dueDate && fee.dueDate < new Date()) {
        hasOverdueFees = true;
      }
    }

    return ok({
      studentId,
      totalOwed,
      totalPaid,
      totalWaived,
      // Not clamped to 0 — see computeFeeBalance's rationale. A student who
      // overpaid one fee while owing on another nets out correctly here.
      outstandingBalance: totalOwed - totalWaived - totalPaid,
      hasOverdueFees,
    });
  } catch (err) {
    console.error("[FeeService.getStudentFinancialSummary]", err);
    return fail("Failed to compute financial summary");
  }
}

/**
 * Lists fees for a student, enriched with live balances.
 */
export async function listStudentFees(
  studentId: string,
  opts?: { academicYearId?: string; semester?: Semester }
): Promise<ApiResult<FeeWithPayments[]>> {
  try {
    const fees = await prisma.fee.findMany({
      where: {
        studentId,
        ...(opts?.academicYearId ? { academicYearId: opts.academicYearId } : {}),
        ...(opts?.semester ? { semester: opts.semester } : {}),
      },
      include: { payments: true },
      orderBy: { dueDate: "asc" },
    });

    return ok(fees);
  } catch (err) {
    console.error("[FeeService.listStudentFees]", err);
    return fail("Failed to fetch fees");
  }
}

/**
 * Generates fees for a student from FeeStructure templates.
 * Safe to call multiple times — existing fees for the same
 * (student, academicYear, semester, category) are skipped.
 */
export async function generateFeesFromStructure(
  opts: {
    studentId: string;
    programmeId: string;
    academicYearId: string;
    semester: Semester;
  },
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ApiResult<{ created: number; skipped: number }>> {
  try {
    const structures = await tx.feeStructure.findMany({
      where: {
        programmeId: opts.programmeId,
        academicYearId: opts.academicYearId,
        semester: opts.semester,
        isActive: true,
      },
    });

    if (structures.length === 0) {
      return ok({ created: 0, skipped: 0 });
    }

    // Check which categories already have a fee for this student/year/semester
    const existing = await tx.fee.findMany({
      where: {
        studentId: opts.studentId,
        academicYearId: opts.academicYearId,
        semester: opts.semester,
      },
      select: { category: true },
    });
    const existingCategories = new Set(existing.map((f) => f.category));

    const toCreate = structures.filter(
      (s) => !existingCategories.has(s.category)
    );

    if (toCreate.length > 0) {
      await tx.fee.createMany({
        data: toCreate.map((s) => ({
          studentId: opts.studentId,
          feeStructureId: s.id,
          academicYearId: opts.academicYearId,
          semester: opts.semester,
          category: s.category as FeeCategory,
          // SNAPSHOT: copy amount now; future template changes won't affect this
          amountDue: s.amount,
        })),
      });
    }

    return ok({
      created: toCreate.length,
      skipped: structures.length - toCreate.length,
    });
  } catch (err) {
    console.error("[FeeService.generateFeesFromStructure]", err);
    return fail("Failed to generate fees");
  }
}

/**
 * System-wide overdue list for the Registry dashboard.
 *
 * Computed in ONE indexed SQL pass instead of N+1 calls to computeFeeBalance
 * — this is the query that has to stay fast once there are thousands of Fee
 * rows. Uses Fee's (dueDate) index. Fully parameterized ($queryRaw template
 * literal), so this is not vulnerable to SQL injection despite being raw SQL.
 */
export async function listOverdueFees() {
  return prisma.$queryRaw<
    Array<{
      feeId: string;
      studentId: string;
      studentNumber: string;
      firstName: string;
      lastName: string;
      category: string;
      dueDate: Date;
      amountDue: Prisma.Decimal;
      waivedAmount: Prisma.Decimal;
      totalPaid: Prisma.Decimal;
      balance: Prisma.Decimal;
    }>
  >`
    SELECT
      f.id AS "feeId",
      f."studentId",
      s."studentNumber",
      u."firstName",
      u."lastName",
      f.category,
      f."dueDate",
      f."amountDue",
      f."waivedAmount",
      COALESCE(p.total_paid, 0) AS "totalPaid",
      f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) AS balance
    FROM "Fee" f
    JOIN "Student" s ON s.id = f."studentId"
    JOIN "User" u ON u.id = s."userId"
    LEFT JOIN (
      SELECT "feeId", SUM(amount) AS total_paid
      FROM "Payment"
      WHERE status = 'COMPLETED'
      GROUP BY "feeId"
    ) p ON p."feeId" = f.id
    WHERE f."dueDate" IS NOT NULL
      AND f."dueDate" < NOW()
      AND f.status NOT IN ('WAIVED', 'CANCELLED')
      AND f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) > 0
      AND s."deletedAt" IS NULL
    ORDER BY f."dueDate" ASC
  `;
}

/**
 * Aggregate outstanding balance across ALL fees with a positive balance —
 * unlike listOverdueFees(), this is NOT restricted to dueDate < NOW(). A
 * fee that's pending but not yet due still counts as money owed; overdue
 * is a subset of outstanding, not a synonym for it. Used by the /payments
 * ledger to show "how much is still owed" alongside the transaction
 * history, since listPayments() only ever queries the Payment table and
 * has no visibility into unpaid/partially-paid Fee balances on its own.
 */
export async function getOutstandingFeesSummary() {
  const rows = await prisma.$queryRaw<
    Array<{ totalOutstanding: Prisma.Decimal | null; feeCount: bigint }>
  >`
    SELECT
      SUM(f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0)) AS "totalOutstanding",
      COUNT(*) AS "feeCount"
    FROM "Fee" f
    JOIN "Student" s ON s.id = f."studentId"
    LEFT JOIN (
      SELECT "feeId", SUM(amount) AS total_paid
      FROM "Payment"
      WHERE status = 'COMPLETED'
      GROUP BY "feeId"
    ) p ON p."feeId" = f.id
    WHERE f.status NOT IN ('WAIVED', 'CANCELLED')
      AND f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) > 0
      AND s."deletedAt" IS NULL
  `;

  return {
    totalOutstanding: toNumber(rows[0]?.totalOutstanding) ?? 0,
    feeCount: Number(rows[0]?.feeCount ?? 0),
  };
}

/**
 * Row-level companion to getOutstandingFeesSummary() — same balance
 * formula and WAIVED/CANCELLED exclusion, but returns one row per
 * outstanding Fee (student, category, balance) instead of just a total.
 * Deliberately NOT restricted to dueDate < NOW() like listOverdueFees() —
 * a fee that isn't due yet still counts as "outstanding," it's just not
 * yet "overdue." Used to render the actual list of who owes what on the
 * /payments ledger, since listPayments() only ever sees money already
 * recorded and has no visibility into unpaid Fee balances on its own.
 */
export async function listOutstandingFees(limit = 25) {
  return prisma.$queryRaw<
    Array<{
      feeId: string;
      studentId: string;
      studentNumber: string;
      firstName: string;
      lastName: string;
      category: string;
      dueDate: Date | null;
      amountDue: Prisma.Decimal;
      waivedAmount: Prisma.Decimal;
      totalPaid: Prisma.Decimal;
      balance: Prisma.Decimal;
    }>
  >`
    SELECT
      f.id AS "feeId",
      f."studentId",
      s."studentNumber",
      u."firstName",
      u."lastName",
      f.category,
      f."dueDate",
      f."amountDue",
      f."waivedAmount",
      COALESCE(p.total_paid, 0) AS "totalPaid",
      f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) AS balance
    FROM "Fee" f
    JOIN "Student" s ON s.id = f."studentId"
    JOIN "User" u ON u.id = s."userId"
    LEFT JOIN (
      SELECT "feeId", SUM(amount) AS total_paid
      FROM "Payment"
      WHERE status = 'COMPLETED'
      GROUP BY "feeId"
    ) p ON p."feeId" = f.id
    WHERE f.status NOT IN ('WAIVED', 'CANCELLED')
      AND f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) > 0
      AND s."deletedAt" IS NULL
    ORDER BY balance DESC
    LIMIT ${limit}
  `;
}

/**
 * Live overdue COUNT for KPI cards (e.g. staff dashboard). Same WHERE
 * logic as listOverdueFees() — dueDate + balance computed from payments,
 * never the cached Fee.status column — so a fee that lapses past its
 * dueDate with zero payment activity is counted immediately, without
 * waiting for an unrelated payment/reversal event to call syncFeeStatus()
 * on it. Returns just a count, so it skips the Student/User joins that
 * listOverdueFees() needs for its row display.
 */
export async function countOverdueFees(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM "Fee" f
    LEFT JOIN (
      SELECT "feeId", SUM(amount) AS total_paid
      FROM "Payment"
      WHERE status = 'COMPLETED'
      GROUP BY "feeId"
    ) p ON p."feeId" = f.id
    JOIN "Student" s ON s.id = f."studentId"
    WHERE f."dueDate" IS NOT NULL
      AND f."dueDate" < NOW()
      AND f.status NOT IN ('WAIVED', 'CANCELLED')
      AND f."amountDue" - f."waivedAmount" - COALESCE(p.total_paid, 0) > 0
      AND s."deletedAt" IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Reconciles the cached `status` column with the real balance. Called after
 * every payment/reversal so the dashboard filter stays accurate without a
 * cron job. Never overrides WAIVED/CANCELLED — those are explicit staff
 * decisions, not derivable from payment arithmetic.
 */
export async function syncFeeStatus(feeId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const fee = await tx.fee.findUniqueOrThrow({ where: { id: feeId } });
  if (fee.status === "WAIVED" || fee.status === "CANCELLED") return fee;

  const paidAgg = await tx.payment.aggregate({
    where: { feeId, status: "COMPLETED" },
    _sum: { amount: true },
  });
  const totalPaid = Number(paidAgg._sum.amount ?? 0);
  const balance = Number(fee.amountDue) - Number(fee.waivedAmount) - totalPaid;

  let status: FeeStatus;
  if (balance <= 0) status = "PAID";
  else if (fee.dueDate && fee.dueDate < new Date()) status = "OVERDUE";
  else if (totalPaid > 0) status = "PARTIALLY_PAID";
  else status = "PENDING";

  if (status !== fee.status) {
    return tx.fee.update({ where: { id: feeId }, data: { status } });
  }
  return fee;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}