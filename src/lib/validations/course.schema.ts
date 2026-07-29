import { z } from "zod";
import { Semester } from "@prisma/client";
import { cuidSchema } from "./common";

export const createCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(15)
    .regex(/^[A-Z]{2,6}\d{3,4}$/, "Course code must look like 'CS201' or 'GEN100'"),
  title: z.string().trim().min(3).max(200),
  creditHours: z.number().int().min(1).max(12),
  programmeId: cuidSchema.optional(), 
});

export const updateCourseSchema = createCourseSchema.partial();

export const createCourseOfferingSchema = z.object({
  courseId: cuidSchema,
  academicYearId: cuidSchema,
  semester: z.nativeEnum(Semester),
  instructorId: cuidSchema.optional(),
  capacity: z.number().int().positive().max(500).optional(),
});
// Note: (courseId, academicYearId, semester) uniqueness is a DB constraint
// (@@unique) — re-validating it here would require a query anyway, so the
// service layer surfaces that error via Prisma's P2002 code instead of
// duplicating the check in Zod.

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type CreateCourseOfferingInput = z.infer<typeof createCourseOfferingSchema>;