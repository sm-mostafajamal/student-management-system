import { z } from "zod";
import { StudentStatus } from "@prisma/client";

// The only four statuses reachable through the registrar Change-Status
// workflow. SUSPENDED/EXPELLED remain in the Prisma enum for legacy data
// but are intentionally excluded here — see schema.prisma comment.
export const WORKFLOW_STATUSES = [
  StudentStatus.ENROLLED,
  StudentStatus.DEFERRED,
  StudentStatus.WITHDRAWN,
  StudentStatus.COMPLETED,
] as const;

const reasonField = z.string().trim().min(5, "Reason must be at least 5 characters.").max(500);
const notesField = z.string().trim().max(1000).optional().or(z.literal(""));

// Enrolled ← Deferred (return from a pause). No status-specific fields
// beyond the standard reason/notes/effective date.
const toEnrolledSchema = z.object({
  targetStatus: z.literal(StudentStatus.ENROLLED),
  reason: reasonField,
  notes: notesField,
  effectiveDate: z.coerce.date().default(() => new Date()),
});

const toDeferredSchema = z.object({
  targetStatus: z.literal(StudentStatus.DEFERRED),
  reason: reasonField,
  notes: notesField,
  deferredDate: z.coerce.date().default(() => new Date()),
  expectedReturnDate: z.coerce.date({
    required_error: "Expected return date is required.",
    invalid_type_error: "Enter a valid expected return date.",
  }),
});

const toWithdrawnSchema = z.object({
  targetStatus: z.literal(StudentStatus.WITHDRAWN),
  reason: reasonField,
  notes: notesField,
  withdrawalDate: z.coerce.date().default(() => new Date()),
});

const toCompletedSchema = z.object({
  targetStatus: z.literal(StudentStatus.COMPLETED),
  reason: reasonField,
  notes: notesField,
  completionDate: z.coerce.date().default(() => new Date()),
  award: z.string().trim().min(2, "Award / qualification title is required.").max(200),
});

const changeStudentStatusUnion = z.discriminatedUnion("targetStatus", [
  toEnrolledSchema,
  toDeferredSchema,
  toWithdrawnSchema,
  toCompletedSchema,
]);

// Cross-field check moved here — applying .refine() to the finished union
// is fine (only union *members* can't be ZodEffects).
export const changeStudentStatusSchema = changeStudentStatusUnion.refine(
  (v) => v.targetStatus !== StudentStatus.DEFERRED || v.expectedReturnDate > v.deferredDate,
  {
    message: "Expected return date must be after the deferred date.",
    path: ["expectedReturnDate"],
  }
);

export type ChangeStudentStatusInput = z.infer<typeof changeStudentStatusUnion>;