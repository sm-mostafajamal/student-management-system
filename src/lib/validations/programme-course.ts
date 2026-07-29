import { z } from "zod";

// ─── Programme ────────────────────────────────────────────────────────────────

export const CreateProgrammeSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, or hyphens")
    .transform((v) => v.trim().toUpperCase()),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(120, "Name must be at most 120 characters")
    .transform((v) => v.trim()),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .transform((v) => v?.trim() || undefined),
});

export const UpdateProgrammeSchema = CreateProgrammeSchema.extend({
  id: z.string().cuid("Invalid programme ID"),
  isActive: z.boolean(),
});

export type CreateProgrammeInput = z.infer<typeof CreateProgrammeSchema>;
export type UpdateProgrammeInput = z.infer<typeof UpdateProgrammeSchema>;

// ─── Course ───────────────────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, or hyphens")
    .transform((v) => v.trim().toUpperCase()),
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(120, "Name must be at most 120 characters")
    .transform((v) => v.trim()),
  description: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v?.trim() || undefined),
  credits: z
    .number()
    .int("Credits must be a whole number")
    .min(1, "Credits must be at least 1")
    .max(12, "Credits must be at most 12"),
  programmeId: z.string().cuid("Invalid programme ID"),
});

export const UpdateCourseSchema = CreateCourseSchema.extend({
  id: z.string().cuid("Invalid course ID"),
  isActive: z.boolean(),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

// ─── Course Offering ──────────────────────────────────────────────────────────

export const SemesterEnum = z.enum(["FALL", "SPRING", "SUMMER"]);

export const CreateOfferingSchema = z.object({
  courseId: z.string().cuid("Invalid course ID"),
  academicYearId: z.string().cuid("Invalid academic year ID"),
  semester: SemesterEnum,
  instructorId: z.string().cuid("Invalid instructor ID"),
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(500, "Capacity must be at most 500"),
});

export const UpdateOfferingSchema = z.object({
  id: z.string().cuid("Invalid offering ID"),
  // Instructor and capacity can change; course/year/semester cannot (unique key)
  instructorId: z.string().cuid("Invalid instructor ID"),
  capacity: z
    .number()
    .int()
    .min(1, "Capacity must be at least 1")
    .max(500),
  isActive: z.boolean(),
});

export type CreateOfferingInput = z.infer<typeof CreateOfferingSchema>;
export type UpdateOfferingInput = z.infer<typeof UpdateOfferingSchema>;