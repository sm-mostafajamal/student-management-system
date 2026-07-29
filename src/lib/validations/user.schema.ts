import { z } from "zod";
import { Role } from "@prisma/client";
import { emailSchema } from "./common";

const nameSchema = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(100)
  .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters");

export const createUserSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.nativeEnum(Role),
});

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Role toggle "login" — per assessment constraints, this is not real auth,
// just a selection of who you're acting as. Kept as its own schema so it's
// obvious at a glance this is NOT a password-based credential check.
export const roleToggleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(Role),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;