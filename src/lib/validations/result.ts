import { z } from "zod";

export const recordGradeSchema = z.object({
  studentId: z.string(),
  courseOfferingId: z.string(),
  numericScore: z.coerce
    .number()
    .min(0, "Score cannot be below 0.")
    .max(100, "Score cannot exceed 100."),
   reason: z.string().min(1).optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export type RecordGradeInput = z.infer<typeof recordGradeSchema>;

export const publishResultSchema = z.object({
  gradeId: z.string().cuid(),
  expectedVersion: z.coerce.number().int().positive(),
});

export type PublishResultInput = z.infer<typeof publishResultSchema>;

export const unpublishResultSchema = z.object({
  gradeId: z.string().cuid(),
  expectedVersion: z.coerce.number().int().positive().optional(),
  reason: z
    .string()
    .trim()
    .min(5, "Please provide a reason of at least 5 characters.")
    .max(500),
});

export type UnpublishResultInput = z.infer<typeof unpublishResultSchema>;