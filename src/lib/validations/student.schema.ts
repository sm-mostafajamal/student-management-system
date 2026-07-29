import { z } from "zod";
import { StudentStatus, Gender } from "@prisma/client";
import { cuidSchema } from "./common";

// ── Business-policy constants (kept here, not magic numbers inline, so a
export const MIN_STUDENT_AGE = 14; // youngest realistic certificate/diploma admit
export const MAX_STUDENT_AGE = 100;

function yearsAgo(n: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const dateOfBirthSchema = z.coerce
  .date({ errorMap: () => ({ message: "Enter a valid date." }) })
  .refine((d) => d.getTime() <= Date.now(), {
    message: "Date of birth cannot be in the future.",
  })
  .refine((d) => d <= yearsAgo(MIN_STUDENT_AGE), {
    message: `Student must be at least ${MIN_STUDENT_AGE} years old.`,
  })
  .refine((d) => d >= yearsAgo(MAX_STUDENT_AGE), {
    message: "Date of birth is not plausible (more than 100 years ago).",
  });

const nameSchema = z.string().trim().min(2, "Must be at least 2 characters").max(100);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);
const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^[+\d][\d\s-]*$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

// Format enforced: PEN/<4-digit year>/<5-digit sequence>, e.g. "PEN/2025/00042"
const studentNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PEN\/\d{4}\/\d{5}$/, "Student number must match format PEN/YYYY/NNNNN");

export const createStudentSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    userId: cuidSchema,
    studentNumber: studentNumberSchema,
    programmeId: cuidSchema,
    admissionAcademicYearId: cuidSchema.optional(),
    status: z.nativeEnum(StudentStatus).default("ACTIVE"),
    dateOfBirth: dateOfBirthSchema,
    gender: z.nativeEnum(Gender).optional(),
    phone: phoneSchema,
    address: z.string().trim().max(500).optional(),
    expectedGraduationDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (!data.dateOfBirth) return true;
      const ageInYears =
        (Date.now() - data.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return ageInYears >= 15;
    },
    {
      message: "Student must be at least 15 years old",
      path: ["dateOfBirth"],
    }
  );

export const updateStudentSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    email: emailSchema.optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    gender: z.nativeEnum(Gender).optional(),
    phone: phoneSchema,
    address: z.string().trim().max(500).optional().or(z.literal("")),
    status: z.nativeEnum(StudentStatus).optional(),
    programmeId: cuidSchema.optional(),
    expectedGraduationDate: z.coerce.date().optional(),
    // Two-step confirmation for the "programme change after payments exist"
    // edge case — see student.service.ts.
    force: z.boolean().optional(),
    changeReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => !(v.force && !v.changeReason?.trim()), {
    message: "Please provide a reason for this change.",
    path: ["changeReason"],
  });
// Status transitions are a service-layer state machine, not a Zod concern
// (e.g. GRADUATED → ACTIVE should never be allowed; WITHDRAWN is terminal).
// Documented here so it isn't mistaken for an oversight:
// Valid forward transitions: ACTIVE ⇄ DEFERRED, ACTIVE ⇄ SUSPENDED,
// ACTIVE → GRADUATED, ACTIVE/DEFERRED/SUSPENDED → WITHDRAWN,
// ACTIVE/SUSPENDED → EXPELLED. GRADUATED/WITHDRAWN/EXPELLED are terminal.
export const studentQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  programmeId: z.string().cuid().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentQueryInput = z.infer<typeof studentQuerySchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;