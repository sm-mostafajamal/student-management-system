import { z } from "zod";
import { PaymentMethod } from "@/types";

export const listPaymentsFilterSchema = z.object({
  studentId: z.string().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  status: z.enum(["COMPLETED", "FAILED", "REVERSED"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

// Payment has no `version` column (unlike Grade) — no optimistic-concurrency
// field to thread through. Only a reason is required.
export const reversePaymentSchema = z.object({
  paymentId: z.string().min(1),
  studentId: z.string().min(1), // carried through only to know which page to revalidate
  reason: z
    .string()
    .trim()
    .min(3, "Please give a brief reason (min 3 characters).")
    .max(500, "Reason is too long."),
});