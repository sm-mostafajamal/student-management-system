import { z } from "zod";
import { ProgrammeLevel } from "@prisma/client";

export const createProgrammeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, and hyphens only"),
  name: z.string().trim().min(3).max(150),
  level: z.nativeEnum(ProgrammeLevel),
  durationYears: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 year")
    .max(7, "Duration exceeds maximum programme length"),
  departmentName: z.string().trim().max(100).optional(),
  isActive: z.boolean().default(true),
});

// Programmes should not be hard-deactivated while students are actively
// enrolled — that check requires a DB lookup and belongs in the service
// layer, not here. This schema only validates shape.
export const updateProgrammeSchema = createProgrammeSchema.partial();

export type CreateProgrammeInput = z.infer<typeof createProgrammeSchema>;
export type UpdateProgrammeInput = z.infer<typeof updateProgrammeSchema>;