import { z } from "zod";
import { LetterGrade } from "@prisma/client";
import { cuidSchema } from "./common";

export const createGradeSchema = z.object({
  studentId: cuidSchema,
  courseOfferingId: cuidSchema,
  numericScore: z.number().min(0).max(100).optional(),
  letterGrade: z.nativeEnum(LetterGrade).optional(),
  gpaPoints: z.number().min(0).max(4.0).optional(),
  computedById: cuidSchema.optional(),
});

// A published grade cannot be edited through this schema — it must go
// through updateGradeWithAuditSchema below, which forces a reason. This
// asymmetry is intentional: it makes "silent post-publish edit" a type
// error, not just a policy someone can forget.
export const publishGradeSchema = z.object({
  isPublished: z.literal(true),
});

export const updateGradeWithAuditSchema = z.object({
  numericScore: z.number().min(0).max(100).optional(),
  letterGrade: z.nativeEnum(LetterGrade).optional(),
  gpaPoints: z.number().min(0).max(4.0).optional(),
  reason: z
    .string()
    .trim()
    .min(15, "Grade changes require a detailed reason (min 15 characters) for the exam board audit trail")
    .max(1000),
  changedById: cuidSchema,
});
// grade.service.ts is expected to: (1) read the current Grade row, (2) write
// a GradeChangeLog capturing old + new values BEFORE, (3) apply the update —
// all inside a single Prisma $transaction so a crash can't produce an
// audited-but-not-applied (or applied-but-unaudited) grade change.

export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeWithAuditInput = z.infer<typeof updateGradeWithAuditSchema>;