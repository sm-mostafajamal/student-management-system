import { z } from "zod";

export const enrollStudentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required."),
  courseOfferingId: z.string().min(1, "Course offering is required."),
});
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

export const dropEnrollmentSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required."),
  // Carried through purely so the action knows which roster page to revalidate —
  // stripped before calling dropEnrollment() below.
  courseOfferingId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Please give a brief reason (min 3 characters).")
    .max(500, "Reason is too long."),
  expectedVersion: z.coerce.number().int().nonnegative().optional(),
});
export type DropEnrollmentInput = z.infer<typeof dropEnrollmentSchema>;