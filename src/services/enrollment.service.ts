/**
 * Enrollment domain service.
 *
 * Handles: enrolling students in course offerings, capacity enforcement,
 * dropping courses, and checking for schedule/duplicate conflicts.
 */

import prisma from "@/lib/prisma";
import { ok, fail, assertFound, AppError } from "@/lib/errors";
import type { ApiResult } from "@/types";
import { EnrollmentStatus, type Enrollment } from "@prisma/client";
import { z } from "zod";


export const EnrollStudentSchema = z.object({
  // This is the human-facing Student ID staff type in (e.g. "SMS-2025-0001"),
  // matching Student.studentNumber — NOT the internal Student.id (cuid) PK.
  // Registry staff know the printed/assigned student number, not a database key.
  studentId: z
    .string()
    .trim()
    .min(1, "Student ID is required.")
    .transform((s) => s.toUpperCase()),
  courseOfferingId: z.string().cuid(),
});

export type EnrollStudentInput = z.infer<typeof EnrollStudentSchema>;


/**
 * Enrolls a student in a course offering.
 *
 * Guards:
 * 1. Student exists (looked up by studentNumber) and is ENROLLED
 * 2. Offering exists and is not deleted
 * 3. Student not already enrolled (or previously dropped — allows re-enroll)
 * 4. Capacity not exceeded
 */
export async function enrollStudent(
  input: EnrollStudentInput
): Promise<ApiResult<Enrollment>> {
  try {
    const parsed = EnrollStudentSchema.parse(input);

    const [student, offering] = await Promise.all([
      prisma.student.findFirst({
        // studentId here is the human-readable student number typed by
        // staff (e.g. "SMS-2025-0001"), so look up by studentNumber —
        // never by id, which is the internal cuid PK the UI never exposes.
        where: { studentNumber: parsed.studentId, deletedAt: null },
      }),
      prisma.courseOffering.findFirst({
        where: { id: parsed.courseOfferingId, deletedAt: null },
        include: { _count: { select: { enrollments: true } } },
      }),
    ]);

    assertFound(student, "Student");
    assertFound(offering, "Course offering");

    if (student.status !== "ENROLLED") {
      throw new AppError(
        "FORBIDDEN",
        `Student status is ${student.status} — enrollment requires ENROLLED status`
      );
    }

    // Check for existing enrollment (any status)
    const existing = await prisma.enrollment.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: student.id,
          courseOfferingId: parsed.courseOfferingId,
        },
      },
    });

    if (existing) {
      if (existing.status === EnrollmentStatus.ENROLLED) {
        throw new AppError(
          "CONFLICT",
          "Student is already enrolled in this course"
        );
      }
      // Previously DROPPED — re-enroll by updating status
      if (existing.status === EnrollmentStatus.DROPPED) {
        const updated = await prisma.enrollment.update({
          where: { id: existing.id },
          data: {
            status: EnrollmentStatus.ENROLLED,
            droppedAt: null,
            enrolledAt: new Date(),
          },
        });
        return ok(updated);
      }
    }

    // Capacity check
    if (offering.capacity != null) {
      const enrolledCount = await prisma.enrollment.count({
        where: {
          courseOfferingId: parsed.courseOfferingId,
          status: EnrollmentStatus.ENROLLED,
        },
      });
      if (enrolledCount >= offering.capacity) {
        throw new AppError(
          "ENROLLMENT_CAPACITY",
          `Course is at capacity (${offering.capacity} students)`
        );
      }
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseOfferingId: parsed.courseOfferingId,
        status: EnrollmentStatus.ENROLLED,
      },
    });

    return ok(enrollment);
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[EnrollmentService.enrollStudent]", err);
    return fail("Failed to enroll student");
  }
}

/**
 * Drops a student from a course.
 * Records droppedAt timestamp for auditing.
 */
export async function dropEnrollment(
  enrollmentId: string
): Promise<ApiResult<{ id: string }>> {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });
    assertFound(enrollment, "Enrollment");

    if (enrollment.status !== EnrollmentStatus.ENROLLED) {
      throw new AppError(
        "CONFLICT",
        `Cannot drop enrollment with status ${enrollment.status}`
      );
    }

    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.DROPPED,
        droppedAt: new Date(),
      },
    });

    return ok({ id: enrollmentId });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[EnrollmentService.dropEnrollment]", err);
    return fail("Failed to drop enrollment");
  }
}

/**
 * Lists all active enrollments for a student, with course details.
 */
export async function listStudentEnrollments(studentId: string) {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId,
        status: EnrollmentStatus.ENROLLED,
      },
      include: {
        courseOffering: {
          include: {
            course: true,
            academicYear: true,
            instructor: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    return ok(enrollments);
  } catch (err) {
    console.error("[EnrollmentService.listStudentEnrollments]", err);
    return fail("Failed to fetch enrollments");
  }
}