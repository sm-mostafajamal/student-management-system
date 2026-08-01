import { z } from "zod";
import { ProgrammeLevel } from "@/types";

// Shared money field — same rules as the moneySchema in common.ts but
// defined inline here so this file stays self-contained.
const feeField = z.coerce
  .number({ invalid_type_error: "Fee must be a number" })
  .min(0, "Fee cannot be negative")
  .max(100_000_000, "Fee value is unrealistically large")
  .default(0);

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
  level: z.nativeEnum(ProgrammeLevel, {
    errorMap: () => ({ message: "Select a programme level." }),
  }),
  durationYears: z.coerce
    .number()
    .int("Duration must be a whole number of years")
    .min(1, "Duration must be at least 1 year")
    .max(10, "Duration must be at most 10 years"),
  departmentName: z
    .string()
    .max(120, "Department name must be at most 120 characters")
    .optional()
    .transform((v) => v?.trim() || undefined),
  baseFee: feeField,
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
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be at most 120 characters")
    .transform((v) => v.trim()),
  creditHours: z
    .number()
    .int("Credit hours must be a whole number")
    .min(1, "Credit hours must be at least 1")
    .max(12, "Credit hours must be at most 12"),
  programmeId: z.string().cuid("Invalid programme ID"),
  courseFee: feeField,
});
export const UpdateCourseSchema = CreateCourseSchema.extend({
  id: z.string().cuid("Invalid course ID"),
  isActive: z.boolean(),
});
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

// ─── Course Offering ──────────────────────────────────────────────────────────
export const SemesterEnum = z.enum(["FIRST_SEMESTER", "SECOND_SEMESTER", "SUMMER_SEMESTER"]);
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
