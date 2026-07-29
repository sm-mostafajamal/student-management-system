import { z } from "zod";
import { cuidSchema } from "./common";

export const createSubmissionSchema = z.object({
  assessmentId: cuidSchema,
  studentId: cuidSchema,
  fileUrl: z.string().trim().url().optional(),
  content: z.string().trim().max(50_000).optional(),
}).refine((data) => data.fileUrl || data.content, {
  message: "Submission must include either a file or text content",
});
// isLate and attemptNumber are DELIBERATELY not accepted from the client —
// they're computed server-side in submission.service.ts:
//   isLate = submittedAt > (assessment.dueDate + gracePeriodMinutes)
//   attemptNumber = (count of this student's prior attempts on this
//                    assessment) + 1, rejected if > assessment.maxAttempts
// Trusting a client-supplied isLate/attemptNumber would let a student
// falsify their own submission timing — a real integrity risk.

// Grading is a separate action from submitting (different actor: staff, not
// student), so it's a separate schema. `score <= assessment.maxScore` can't
// be a static Zod rule since maxScore varies per assessment — this factory
// builds a schema bound to a specific assessment's ceiling at call time.
export const buildGradeSubmissionSchema = (maxScore: number) =>
  z.object({
    score: z
      .number()
      .nonnegative()
      .max(maxScore, `Score cannot exceed the assessment's maximum of ${maxScore}`),
    feedback: z.string().trim().max(2000).optional(),
    gradedById: cuidSchema,
  });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;