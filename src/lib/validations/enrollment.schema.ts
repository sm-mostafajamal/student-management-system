import { z } from "zod";
import { EnrollmentStatus } from "@prisma/client";
import { cuidSchema } from "./common";

export const createEnrollmentSchema = z.object({
  studentId: cuidSchema,
  courseOfferingId: cuidSchema,
});
// Business rules enforced in enrollment.service.ts, NOT here, because they
// require DB reads:
//  - Reject if Student.status is not ENROLLED (a SUSPENDED student can't enroll)
//  - Reject if CourseOffering capacity is reached (COUNT of ENROLLED rows)
//  - Reject if Student is already enrolled (DB @@unique also backstops this)
//  - Reject if the CourseOffering's AcademicYear.isCurrent is false, unless
//    explicitly performing a backdated/administrative enrollment

export const updateEnrollmentStatusSchema = z.object({
  status: z.nativeEnum(EnrollmentStatus),
  droppedAt: z.coerce.date().optional(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;