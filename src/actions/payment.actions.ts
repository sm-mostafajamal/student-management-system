"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  recordPayment,
  reversePayment,
  OverpaymentError,
  DuplicatePaymentReferenceError,
  FeeNotFoundError,
} from "@/services/payment.service";
import { recordPaymentSchema, reversePaymentSchema } from "@/lib/validations/fee.schema";
import type { ApiResult } from "@/types";

async function requireStaff() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") {
    throw new Error("Only Registry staff can record or reverse payments.");
  }
  return user;
}

export async function recordPaymentAction(input: unknown): Promise<ApiResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Please check the form for errors.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const payment = await recordPayment({ ...parsed.data, recordedById: staff.id });

    const fee = await prisma.fee.findUnique({ where: { id: parsed.data.feeId }, select: { studentId: true } });
    if (fee) {
      revalidatePath(`/fees/students/${fee.studentId}`);
      revalidatePath("/my-fees");
    }
    revalidatePath("/fees");

    return { success: true, data: { id: payment.id } };
  } catch (err) {
    if (err instanceof OverpaymentError) {
      return { success: false, error: `Amount exceeds the outstanding balance of ${err.balance.toFixed(2)}.` };
    }
    if (err instanceof DuplicatePaymentReferenceError || err instanceof FeeNotFoundError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: err instanceof Error ? err.message : "Failed to record payment." };
  }
}

export async function reversePaymentAction(input: unknown): Promise<ApiResult<{ id: string }>> {
  try {
    const staff = await requireStaff();
    const parsed = reversePaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Please check the form for errors.", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const payment = await reversePayment(parsed.data.paymentId, staff.id, parsed.data.reversalReason);
    revalidatePath(`/fees/students/${payment.studentId}`);
    revalidatePath("/fees");
    return { success: true, data: { id: payment.id } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to reverse payment." };
  }
}