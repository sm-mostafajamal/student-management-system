import { z } from "zod";
import { AssessmentType } from "@prisma/client";
import { cuidSchema } from "./common";

export const createAssessmentSchema = z.object({
  courseOfferingId: cuidSchema,
  title: z.string().trim().min(3).max(150),
  type: z.nativeEnum(AssessmentType),
  weightPercentage: z
    .number()
    .positive("Weight must be greater than 0")
    .max(100, "A single assessment cannot exceed 100% weight"),
  maxScore: z.number().positive().max(1000),
  dueDate: z.coerce.date(),
  gracePeriodMinutes: z.number().int().nonnegative().max(1440).default(0), // capped at 24h
  maxAttempts: z.number().int().min(1).max(10).default(1),
});

export const updateAssessmentSchema = createAssessmentSchema.partial().omit({
  courseOfferingId: true,
});

export const publishAssessmentSchema = z.object({
  isPublished: z.literal(true),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;