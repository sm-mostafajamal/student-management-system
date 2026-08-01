import { z } from "zod";
import { Semester, FeeCategory, PaymentMethod } from "@prisma/client";
import { cuidSchema, moneySchema } from "./common";
// import { Semester, FeeCategory, PaymentMethod } from "@/types";

export const createFeeStructureSchema = z.object({
  programmeId: cuidSchema,
  academicYearId: cuidSchema,
  semester: z.nativeEnum(Semester),
  category: z.nativeEnum(FeeCategory),
  amount: moneySchema,
});

export const updateFeeStructureAmountSchema = z.object({
  id: z.string().min(1),
  amount: moneySchema,
});
export const assignFeesSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  semester: z.nativeEnum(Semester),
});

export const bulkAssignFeesSchema = z.object({
  programmeId: z.string().min(1),
  academicYearId: z.string().min(1),
  semester: z.nativeEnum(Semester),
});
// `amount` is bounded here for shape/sanity only — the REAL "does this
// exceed the balance" check happens inside payment.service.ts, atomically,
// because that check needs a DB round-trip Zod can't do.
export const recordPaymentSchema = z.object({
  studentId: cuidSchema,
  feeId: z.string().min(1),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero")
    .max(10_000_000),
  method: z.nativeEnum(PaymentMethod),
  reference: z
    .string()
    .trim()
    .min(3, "Reference must be at least 3 characters")
    .max(100, "Reference is too long"),
  paidAt: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: "Payment date cannot be in the future",
  }),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export const reversePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reversalReason: z
    .string()
    .trim()
    .min(5, "Please provide a reason (min 5 characters) — this goes on the audit trail")
    .max(500),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;