/**
 * Program Enrollment Status workflow.
 *
 * Deliberately separate from student.service.ts (SRP): student.service owns
 * profile/programme CRUD, this file owns the ENROLLED/DEFERRED/WITHDRAWN/
 * COMPLETED state machine — legal transitions, course-level side effects,
 * and the immutable audit trail. Nothing outside this file should ever
 * write Student.status directly.
 */
import { Prisma, StudentStatus, EnrollmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { ChangeStudentStatusInput } from "@/lib/validations/enrollment-status.schema";
import { getAllowedNextStatuses } from "@/lib/enrollment-status-rules";

export { getAllowedNextStatuses };
function assertTransitionAllowed(current: StudentStatus, target: StudentStatus): void {
  if (current === target) {
    throw new AppError("CONFLICT", `Student is already ${target.charAt(0) + target.slice(1).toLowerCase()}.`);
  }
  const allowed = getAllowedNextStatuses(current);
  if (!allowed.includes(target)) {
    throw new AppError(
      "FORBIDDEN",
      allowed.length
        ? `Cannot change status from ${current} to ${target}. Allowed next status(es): ${allowed.join(", ")}.`
        : `${current} is a terminal status and cannot be changed.`
    );
  }
}

// A course Enrollment counts as "active" if it's ENROLLED or SUSPENDED
// (suspended-for-deferral is still an obligation, not a closed course).
const ACTIVE_ENROLLMENT_STATUSES: EnrollmentStatus[] = [EnrollmentStatus.ENROLLED, EnrollmentStatus.SUSPENDED];

export interface ChangeStatusResult {
  studentId: string;
  oldStatus: StudentStatus;
  newStatus: StudentStatus;
  affectedCourseCount: number;
}

/**
 * Executes one validated status change, all-or-nothing:
 *  1. transition legality
 *  2. status-specific business validation (e.g. no active courses to Complete)
 *  3. course-level side effects
 *  4. Student metadata update
 *  5. immutable StudentStatusHistory row
 */
export async function changeStudentStatus(
  studentId: string,
  input: ChangeStudentStatusInput,
  changedById: string
): Promise<ChangeStatusResult> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student || student.deletedAt) {
      throw new AppError("NOT_FOUND", "Student not found.");
    }

    const current = student.status;
    const target = input.targetStatus;
    assertTransitionAllowed(current, target);

    let affectedCourseCount = 0;
    const studentData: Prisma.StudentUpdateInput = { status: target };

    switch (target) {
      case StudentStatus.DEFERRED: {
        const { count } = await tx.enrollment.updateMany({
          where: { studentId, status: EnrollmentStatus.ENROLLED },
          data: { status: EnrollmentStatus.SUSPENDED },
        });
        affectedCourseCount = count;

        studentData.deferredAt = input.deferredDate;
        studentData.expectedReturnDate = input.expectedReturnDate;
        studentData.deferralReason = input.reason;
        break;
      }

      case StudentStatus.WITHDRAWN: {
        const { count } = await tx.enrollment.updateMany({
          where: { studentId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
          data: { status: EnrollmentStatus.WITHDRAWN },
        });
        affectedCourseCount = count;

        studentData.withdrawnAt = input.withdrawalDate;
        studentData.withdrawalReason = input.reason;
        break;
      }

      case StudentStatus.COMPLETED: {
        // "No active courses, no in-progress courses" — both ENROLLED and
        // SUSPENDED count as not-yet-closed-out.
        const activeCount = await tx.enrollment.count({
          where: { studentId, status: { in: ACTIVE_ENROLLMENT_STATUSES } },
        });
        if (activeCount > 0) {
          throw new AppError(
            "CONFLICT",
            "Student still has active courses and cannot be marked Completed."
          );
        }

        studentData.completedAt = input.completionDate;
        studentData.award = input.award;
        break;
      }

      case StudentStatus.ENROLLED: {
        // Only reachable from DEFERRED — resume whatever was suspended.
        const { count } = await tx.enrollment.updateMany({
          where: { studentId, status: EnrollmentStatus.SUSPENDED },
          data: { status: EnrollmentStatus.ENROLLED },
        });
        affectedCourseCount = count;

        // Clear the now-stale deferral metadata.
        studentData.deferredAt = null;
        studentData.expectedReturnDate = null;
        studentData.deferralReason = null;
        break;
      }
    }

    await tx.student.update({ where: { id: studentId }, data: studentData });

    await tx.studentStatusHistory.create({
      data: {
        studentId,
        oldStatus: current,
        newStatus: target,
        reason: input.reason,
        notes: input.notes || null,
        changedById,
      },
    });

    return { studentId, oldStatus: current, newStatus: target, affectedCourseCount };
  });
}

export async function getStudentStatusHistory(studentId: string) {
  return prisma.studentStatusHistory.findMany({
    where: { studentId },
    include: { changedBy: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { changedAt: "desc" },
  });
}