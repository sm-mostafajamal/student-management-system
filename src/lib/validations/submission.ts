import { z } from "zod";

// Deliberately minimal: file TYPE/SIZE validation is business logic that
// already lives in validateSubmissionFile() inside submission.service.ts —
// duplicating it here would mean two places to update when rules change.
// This schema only checks what the Server Action itself is responsible for:
// that the required form fields are present at all.
export const submitAssessmentFormSchema = z.object({
  assessmentId: z.string().min(1, "Missing assessment reference."),
});