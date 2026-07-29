import { z } from "zod";
import { cuidSchema } from "./common";

export const publishGradeSchema = z.object({
  isPublished: z.literal(true),
});