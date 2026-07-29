// Records and reverses payments. This file is the answer to two of the
// hardest requirements: "prevent overpayment" and "concurrent payment
// attempts" — both are solved by the SAME mechanism, a row lock.

import { prisma } from "@/lib/prisma";
import { Prisma, PaymentMethod } from "@prisma/client";
import { syncFeeStatus } from "./fee.service";

export class OverpaymentError extends Error {
  constructor(
    public balance: number,
    public attempted: number
  ) {
    super(`Payment of ${attempted} exceeds the outstanding balance of ${balance}.`);
  }
}
export class DuplicatePaymentReferenceError extends Error {
  constructor(reference: string) {
    super(`A payment with reference "${reference}" has already been recorded. Check before re-submitting.`);
  }
}
export class FeeNotFoundError extends Error {}

interface RecordPaymentInput {
  feeId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  paidAt: Date;
  recordedById: string;
}

const EPSILON = 0.005; // tolerate sub-cent floating rounding only, never a real over/under-payment

/**
 * Records a payment, atomically re-checking the balance to prevent both
 * overpayment and concurrent double-spend.
 *
 * Concurrency strategy: `SELECT ... FOR UPDATE` takes a row lock on the Fee
 * for the lifetime of the transaction. If two staff members submit a
 * payment for the SAME fee at the same instant:
 *   1. Transaction A locks the Fee row, reads balance = 500, inserts a
 *      500 payment, commits, releasing the lock.
 *   2. Transaction B was blocked on the lock — it only proceeds after A
 *      commits, then re-reads the payment sum (now includes A's payment),
 *      sees balance = 0, and correctly throws OverpaymentError.
 * Without the lock, both transactions could read the same stale
 * "balance = 500" snapshot and both succeed, producing a 500 overpayment.
 *
 * Idempotency: Payment.reference has a DB-level unique constraint — a
 * duplicate submission (double-click, retried network request) is rejected
 * even if it somehow bypassed the lock logic above.
 */
export async function recordPayment(input: RecordPaymentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const feeRows = await tx.$queryRaw<
        Array<{ 
          id: string; 
          studentId: string; 
          amountDue: Prisma.Decimal; 
          waivedAmount: Prisma.Decimal; 
          status: string 
        }>
      >`SELECT id, "studentId", "amountDue", "waivedAmount", status FROM "Fee" WHERE id = ${input.feeId} FOR UPDATE`;

      const fee = feeRows[0];
      if (!fee) throw new FeeNotFoundError("Fee record not found.");
      if (fee.status === "CANCELLED") {
        throw new FeeNotFoundError("This fee has been cancelled and cannot accept payments.");
      }

      const paidAgg = await tx.payment.aggregate({
        where: { feeId: input.feeId, status: "COMPLETED" },
        _sum: { amount: true },
      });
      const totalPaid = Number(paidAgg._sum.amount ?? 0);
      const balance = Number(fee.amountDue) - Number(fee.waivedAmount) - totalPaid;

      if (input.amount > balance + EPSILON) {
        throw new OverpaymentError(round2(balance), input.amount);
      }

      const payment = await tx.payment.create({
        data: {
          feeId: input.feeId,
          studentId: fee.studentId,
          reference: input.reference,
          amount: input.amount,
          method: input.method,
          status: "COMPLETED",
          paidAt: input.paidAt,
          recordedById: input.recordedById,
        },
      });

      await syncFeeStatus(input.feeId, tx);
      return payment;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicatePaymentReferenceError(input.reference);
    }
    throw err;
  }
}

/**
 * Payments are NEVER deleted — a bounced cheque, wrong amount, or wrong
 * student is corrected by reversal, preserving a full audit trail
 * (who reversed it, when, why). Reversing frees up balance for the student
 * automatically via syncFeeStatus.
 */
export async function reversePayment(paymentId: string, reversedById: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status === "REVERSED") {
      throw new Error("This payment has already been reversed.");
    }
    const reversed = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REVERSED", reversedById, reversedAt: new Date(), reversalReason: reason },
    });
    await syncFeeStatus(payment.feeId, tx);
    return reversed;
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}