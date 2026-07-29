import { z } from "zod";
import { PaymentMethod } from "@prisma/client";
import { cuidSchema, moneySchema } from "./common";

export const createPaymentSchema = z.object({
  feeId: cuidSchema,
  studentId: cuidSchema,
  reference: z
    .string()
    .trim()
    .min(4, "Reference is too short to be meaningful")
    .max(100)
    // Used as an idempotency key at the DB level (@unique). Service layer
    // should treat a P2002 on this field as "duplicate submission, not a
    // real error" and return the existing payment rather than a 500.
    ,
  amount: moneySchema,
  method: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date().refine((date) => date.getTime() <= Date.now(), {
    message: "Payment date cannot be in the future",
  }),
  recordedById: cuidSchema,
});
// Deliberately NOT validated here: "amount <= remaining balance." PEN
// Global's registry allows overpayment (credit-note workflow), so this is a
// business policy check in payment.service.ts, potentially just a WARNING
// surfaced to staff rather than a hard block — a schema-level refine can't
// express "warn but allow."

export const reversePaymentSchema = z.object({
  reversedById: cuidSchema,
  reversalReason: z
    .string()
    .trim()
    .min(10, "Provide a substantive reversal reason for the audit trail")
    .max(500),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;