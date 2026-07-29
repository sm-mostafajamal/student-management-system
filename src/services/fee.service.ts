/**
 * src/services/fee.service.ts
 *
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
import { toNumberRequired, toNumber, fromNumber } from "@/lib/decimal";
import type {
  ApiResult,
  FeeBalance,
  StudentFinancialSummary,
  FeeWithPayments,
} from "@/types";
import {
  FeeStatus,
  PaymentStatus,
  PaymentMethod,
  Semester,
  type FeeCategory,
} from "@prisma/client";
import { z } from "zod";

export class FeeAssignmentError extends Error {}
// ─── Validation schemas ───────────────────────────────────────────────────────

export const RecordPaymentSchema = z.object({
  feeId: z.string().cuid(),
  studentId: z.string().cuid(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().min(1).max(100),
  paidAt: z.coerce.date().optional(),
  recordedById: z.string().cuid(),
});

export const WaiveFeeSchema = z.object({
  waivedAmount: z.number().positive(),
  waivedReason: z.string().min(10).max(500),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

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
    const balance = Math.max(0, amountDue - waivedAmount - totalPaid);
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
      outstandingBalance: Math.max(0, totalOwed - totalWaived - totalPaid),
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
export async function generateFeesFromStructure(opts: {
  studentId: string;
  programmeId: string;
  academicYearId: string;
  semester: Semester;
}): Promise<ApiResult<{ created: number; skipped: number }>> {
  try {
    const structures = await prisma.feeStructure.findMany({
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
    const existing = await prisma.fee.findMany({
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
      await prisma.fee.createMany({
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
 * Records a payment against a fee.
 * Checks: fee exists, reference is unique, amount doesn't exceed balance.
 * Updates Fee.status after recording.
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<ApiResult<{ paymentId: string }>> {
  try {
    const parsed = RecordPaymentSchema.parse(input);

    const fee = await prisma.fee.findUnique({
      where: { id: parsed.feeId },
      include: { payments: { where: { status: PaymentStatus.COMPLETED } } },
    });
    assertFound(fee, "Fee");

    // Idempotency check — blocks double-submitted payments at service level
    // (DB unique constraint is the final guard)
    const duplicate = await prisma.payment.findUnique({
      where: { reference: parsed.reference },
    });
    if (duplicate) {
      throw new AppError(
        "PAYMENT_DUPLICATE",
        `Payment reference "${parsed.reference}" already exists`
      );
    }

    const amountDue = toNumberRequired(fee.amountDue);
    const waivedAmount = toNumberRequired(fee.waivedAmount);
    const totalPaid = fee.payments.reduce(
      (sum, p) => sum + toNumberRequired(p.amount),
      0
    );
    const remainingBalance = amountDue - waivedAmount - totalPaid;

    if (parsed.amount > remainingBalance + 0.001) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Payment amount (${parsed.amount}) exceeds outstanding balance (${remainingBalance.toFixed(2)})`
      );
    }

    const newTotalPaid = totalPaid + parsed.amount;
    const newBalance = amountDue - waivedAmount - newTotalPaid;
    const newStatus: FeeStatus =
      newBalance <= 0.001
        ? FeeStatus.PAID
        : FeeStatus.PARTIALLY_PAID;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          feeId: parsed.feeId,
          studentId: parsed.studentId,
          reference: parsed.reference,
          amount: fromNumber(parsed.amount),
          method: parsed.method as PaymentMethod,
          status: PaymentStatus.COMPLETED,
          paidAt: parsed.paidAt ?? new Date(),
          recordedById: parsed.recordedById,
        },
      });

      await tx.fee.update({
        where: { id: parsed.feeId },
        data: { status: newStatus },
      });

      return p;
    });

    return ok({ paymentId: payment.id });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[FeeService.recordPayment]", err);
    return fail("Failed to record payment");
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