import { z } from "zod";

export const publishGradeSchema = z.object({
  isPublished: z.literal(true),
});