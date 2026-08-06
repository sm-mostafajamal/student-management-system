"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/session";
import { reversePaymentSchema } from "@/lib/validations/fee.schema";
import { reversePayment } from "@/services/payment.service";
import { Role } from "@/types";
import type { ApiResult } from "@/types";

export async function reversePaymentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    return { success: false, error: "Not authenticated." };
  }

  const parsed = reversePaymentSchema.safeParse({
    paymentId: formData.get("paymentId"),
    reversalReason: formData.get("reversalReason"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please provide a reason.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // reversePayment() itself: sets status=REVERSED, reversedById,
    // reversedAt, reversalReason, and re-syncs the parent Fee's status via
    // syncFeeStatus(). Nothing re-implemented here.
    //
    // NOTE: unlike assessment/result actions, this service does NOT throw
    // a shared DomainError type — it throws a plain Error (already-reversed
    // case) or lets Prisma's findUniqueOrThrow throw a P2025 (not found).
    // Handled explicitly below rather than via a DomainError instanceof check.
    const payment = await reversePayment(parsed.data.paymentId, user.id, parsed.data.reversalReason);
    revalidatePath("/payments");
    revalidatePath(`/fees/students/${payment.studentId}`);
    return { success: true, data: { id: payment.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { success: false, error: "Payment not found." };
    }
    if (err instanceof Error) {
      // e.g. "This payment has already been reversed." — this service's
      // thrown messages are already user-safe curated text, not raw
      // internals, so surfacing err.message directly is safe here.
      return { success: false, error: err.message };
    }
    console.error("reversePaymentAction failed", err);
    return { success: false, error: "Something went wrong reversing the payment." };
  }
}