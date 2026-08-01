/**
 * Payment-facing service — record/reverse individual payments, plus the
 * read-only ledger query for /payments (staff).
 *
 * Convention: throws plain/custom Errors, returns raw Prisma shapes
 * (no ApiResult wrapper) — this is deliberately NOT fee.service.ts's style,
 * because payment.actions.ts (Server Actions) does its own try/catch and
 * maps these error types to user-facing messages itself.
 *
 * Reuses fee.service.ts's syncFeeStatus() for balance/status recompute after
 * both recording and reversing a payment, so there's one source of truth for
 * "what status should this Fee be in" instead of two competing calculations.
 */
import { Prisma, PaymentMethod, PaymentStatus } from "@prisma/client";

import prisma from "@/lib/prisma";
import { fromNumber, toNumberRequired } from "@/lib/decimal";
import { syncFeeStatus } from "@/services/fee.service";
import type { RecordPaymentInput } from "@/lib/validations/fee.schema";

// ─── Errors ─────────────────────────────────────────────────────────────

export class FeeNotFoundError extends Error {
  constructor(feeId: string) {
    super(`Fee ${feeId} was not found.`);
    this.name = "FeeNotFoundError";
  }
}

export class DuplicatePaymentReferenceError extends Error {
  constructor(reference: string) {
    super(`Payment reference "${reference}" already exists.`);
    this.name = "DuplicatePaymentReferenceError";
  }
}

/**
 * NOT thrown anymore — overpayment is a legitimate outcome (staff
 * intentionally recording a rounded-up bank transfer, a credit-note
 * workflow, etc.), so it's allowed through and simply shows up as a
 * negative balance ("credit") on the Fee and the student's summary. This
 * class is kept (unused) so any external code still importing/catching it
 * doesn't break.
 */
export class OverpaymentError extends Error {
  constructor(public balance: number) {
    super(`Payment amount exceeds the outstanding balance of ${balance.toFixed(2)}.`);
    this.name = "OverpaymentError";
  }
}

/** Generates a reasonably-unique receipt reference when staff leave it blank. */
export function generatePaymentReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCPT-${stamp}-${rand}`;
}

// ─── recordPayment ──────────────────────────────────────────────────────

export async function recordPayment(
  input: RecordPaymentInput & { recordedById: string }
) {
  const fee = await prisma.fee.findUnique({
    where: { id: input.feeId },
    include: { payments: { where: { status: PaymentStatus.COMPLETED } } },
  });
  if (!fee) throw new FeeNotFoundError(input.feeId);

  const reference = input.reference?.trim() || generatePaymentReference();

  const duplicate = await prisma.payment.findUnique({
    where: { reference },
  });
  if (duplicate) throw new DuplicatePaymentReferenceError(reference);

  // Overpayment is allowed by design (see OverpaymentError doc comment
  // above) — the balance is simply allowed to go negative, which the UI
  // surfaces as a credit. No block here.

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        feeId: input.feeId,
        studentId: input.studentId,
        reference,
        amount: fromNumber(input.amount),
        method: input.method as PaymentMethod,
        status: PaymentStatus.COMPLETED,
        paidAt: input.paidAt ?? new Date(),
        recordedById: input.recordedById,
      },
    });
    await syncFeeStatus(input.feeId, tx);
    return payment;
  });
}

// ─── reversePayment ─────────────────────────────────────────────────────

export async function reversePayment(
  paymentId: string,
  reversedById: string,
  reversalReason: string
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === PaymentStatus.REVERSED) {
    throw new Error("This payment has already been reversed.");
  }

  return prisma.$transaction(async (tx) => {
    const reversed = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REVERSED,
        reversedById,
        reversedAt: new Date(),
        reversalReason,
      },
    });
    // Recompute the Fee's balance/status now that this payment no longer counts
    // (syncFeeStatus only sums status=COMPLETED payments, so excluding this one
    // is automatic).
    await syncFeeStatus(payment.feeId, tx);
    return reversed;
  });
}

export interface ListPaymentsFilters {
  studentId?: string;
  method?: PaymentMethod;
  status?: "COMPLETED" | "FAILED" | "REVERSED";
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentLedgerRow {
  id: string;
  reference: string;
  amount: number;
  method: PaymentMethod;
  status: "COMPLETED" | "FAILED" | "REVERSED";
  paidAt: Date;
  studentId: string;
  studentNumber: string;
  studentName: string;
  feeCategory: string;
  recordedByName: string;
  reversedByName: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
}

export async function listPayments(
  filters: ListPaymentsFilters
): Promise<{ items: PaymentLedgerRow[]; total: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.PaymentWhereInput = {
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          paidAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          student: {
            OR: [
              { studentNumber: { contains: filters.search, mode: "insensitive" } },
              { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
              { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        student: { include: { user: true } },
        fee: { select: { category: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
        reversedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  const items: PaymentLedgerRow[] = rows.map((p) => ({
    id: p.id,
    reference: p.reference,
    amount: Number(p.amount),
    method: p.method,
    status: p.status as "COMPLETED" | "FAILED" | "REVERSED",
    paidAt: p.paidAt,
    studentId: p.studentId,
    studentNumber: p.student.studentNumber,
    studentName: `${p.student.user.firstName} ${p.student.user.lastName}`,
    feeCategory: p.fee.category,
    recordedByName: `${p.recordedBy.firstName} ${p.recordedBy.lastName}`,
    reversedByName: p.reversedBy ? `${p.reversedBy.firstName} ${p.reversedBy.lastName}` : null,
    reversedAt: p.reversedAt,
    reversalReason: p.reversalReason,
  }));

  return { items, total };
}