import { z } from "zod";
import { AssessmentType } from "@/types";

export const createAssessmentSchema = z
  .object({
    courseOfferingId: z.string().cuid(),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
    type: z.nativeEnum(AssessmentType),
    weightPercentage: z.coerce.number().min(0).max(100),
    maxScore: z.coerce.number().positive(),
    dueDate: z.coerce.date(),
    gracePeriodMinutes: z.coerce.number().int().min(0).max(24 * 60).default(0),
    maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  })
  .refine((data) => data.dueDate.getTime() > Date.now(), {
    message: "Due date must be in the future.",
    path: ["dueDate"],
  });

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const submitAssessmentSchema = z.object({
  assessmentId: z.string().cuid(),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;