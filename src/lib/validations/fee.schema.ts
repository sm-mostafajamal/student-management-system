import { z } from "zod";
import { Semester, FeeCategory, FeeStatus, PaymentMethod } from "@prisma/client";
import { cuidSchema, moneySchema, nonNegativeMoneySchema } from "./common";
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
  amount: z.coerce.number().positive().max(10_000_000),
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
// Fee (the actual invoice) is normally CREATED by the service layer when a
// student enrolls — it snapshots FeeStructure.amount into amountDue. This
// schema covers the rarer case: an ad-hoc fee/fine not tied to a template
// (feeStructureId omitted), e.g. a library fine.
export const createFeeSchema = z
  .object({
    studentId: cuidSchema,
    feeStructureId: cuidSchema.optional(),
    academicYearId: cuidSchema,
    semester: z.nativeEnum(Semester),
    category: z.nativeEnum(FeeCategory),
    amountDue: moneySchema,
    dueDate: z.coerce.date().optional(),
  });

export const waiveFeeSchema = z.object({
  waivedAmount: nonNegativeMoneySchema,
  waivedReason: z
    .string()
    .trim()
    .min(10, "Provide a substantive reason (min 10 characters) for audit purposes")
    .max(500),
});
// NOTE: "waivedAmount <= amountDue - alreadyPaid" cannot be validated here —
// it requires reading the Fee row and its Payments. Enforced in
// fee.service.ts before the update is committed.

export const updateFeeStatusSchema = z.object({
  status: z.nativeEnum(FeeStatus),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;
export type CreateFeeInput = z.infer<typeof createFeeSchema>;
export type WaiveFeeInput = z.infer<typeof waiveFeeSchema>;