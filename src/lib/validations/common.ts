// Shared primitives reused across every domain schema. Centralizing these
// means a rule change (e.g. money precision) happens in one place instead
// of being copy-pasted (and drifting) across 8 files.

import { z } from "zod";

// Prisma cuid() ids
export const cuidSchema = z.string().cuid({ message: "Invalid ID format" });

// Money: stored as Decimal(10,2) in Postgres. At the API boundary we accept
// a plain number, but constrain it to 2 decimal places and a sane ceiling
// to catch fat-finger entry (e.g. accidentally typing 3 extra zeros).
export const moneySchema = z
  .number({ invalid_type_error: "Amount must be a number" })
  .positive({ message: "Amount must be greater than 0" })
  .max(100_000_000, { message: "Amount exceeds allowed maximum" })
  .refine((val) => Number.isInteger(val * 100), {
    message: "Amount cannot have more than 2 decimal places",
  });

// Same as moneySchema but allows 0 — for fields like waivedAmount that
// legitimately default to zero.
export const nonNegativeMoneySchema = z
  .number()
  .nonnegative({ message: "Amount cannot be negative" })
  .max(100_000_000)
  .refine((val) => Number.isInteger(val * 100), {
    message: "Amount cannot have more than 2 decimal places",
  });

// Emails are normalized (trim + lowercase) BEFORE the unique constraint is
// ever checked. Without this, "Jane@Pen.edu" and "jane@pen.edu" pass Zod as
// "different" strings but collide unpredictably depending on DB collation.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Invalid email address" });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;