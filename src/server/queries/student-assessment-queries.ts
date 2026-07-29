import "server-only";
import { prisma } from "@/lib/prisma";
import { EnrollmentStatus } from "@/types";

/**
 * Returns null if the assessment doesn't exist OR the student isn't
 * ENROLLED in its course offering — deliberately not distinguishing the
 * two to the caller, so a student can't probe for the existence of
 * assessments in courses they're not enrolled in via a 404 vs 403 signal.
 */
export async function getAssessmentForStudent(assessmentId: string, studentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: { courseOffering: { include: { course: true, academicYear: true } } },
  });
  if (!assessment) return null;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      courseOfferingId: assessment.courseOfferingId,
      status: EnrollmentStatus.ENROLLED,
    },
  });
  if (!enrollment) return null;

  const submission = await prisma.submission.findFirst({
    where: { assessmentId, studentId, isCurrent: true },
  });

  return { assessment, submission };
}