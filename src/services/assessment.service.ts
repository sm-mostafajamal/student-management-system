import { z } from "zod";
import { AssessmentType } from "@/types";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { Role } from "@/types";
import type { CreateAssessmentInput, UpdateAssessmentInput } from "@/lib/validations/assessment-submission";
import type { SessionUser } from "@/types";


export async function createAssessment(
  input: CreateAssessmentInput,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can create assessments.");
  }

  const courseOffering = await prisma.courseOffering.findFirst({
    where: { id: input.courseOfferingId, deletedAt: null },
  });
  if (!courseOffering) {
    throw new DomainError("NOT_FOUND", "Course offering not found.");
  }

  // Hidden edge case: assessment weightings within one course offering
  // conventionally sum to 100%. We enforce that at creation time rather
  // than silently allowing a >100% grading scheme that would only surface
  // as a confusing transcript later.
  const existingWeight = await prisma.assessment.aggregate({
    where: { courseOfferingId: input.courseOfferingId, deletedAt: null },
    _sum: { weightPercentage: true },
  });
  const currentTotal = Number(existingWeight._sum.weightPercentage ?? 0);
  const projectedTotal = currentTotal + input.weightPercentage;
  if (projectedTotal > 100) {
    throw new DomainError(
      "WEIGHT_EXCEEDED",
      `This would push the offering's total weighting to ${projectedTotal.toFixed(
        2
      )}%, over the 100% cap (currently ${currentTotal.toFixed(2)}%).`
    );
  }

  return prisma.assessment.create({
    data: {
      courseOfferingId: input.courseOfferingId,
      title: input.title,
      type: input.type,
      weightPercentage: input.weightPercentage,
      maxScore: input.maxScore,
      dueDate: input.dueDate,
      gracePeriodMinutes: input.gracePeriodMinutes,
      maxAttempts: input.maxAttempts,
    },
  });
}
export async function updateAssessment(
  assessmentId: string,
  input: UpdateAssessmentInput,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can edit assessments.");
  }

  const existing = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: { submissions: { where: { isCurrent: true }, select: { id: true } } },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Assessment not found.");
  }

  // Once students have submitted work, changing the grading shape out from
  // under them (weight, max score, or type) would silently invalidate marks
  // already recorded against the old scale. Title, due date, grace period,
  // and max attempts remain safe to edit at any time.
  const hasSubmissions = existing.submissions.length > 0;
  if (hasSubmissions) {
    const touchesGradingShape =
      input.weightPercentage !== undefined ||
      input.maxScore !== undefined ||
      input.type !== undefined;
    if (touchesGradingShape) {
      throw new DomainError(
        "CONFLICT",
        "This assessment already has submissions — weight, max score, and type can no longer be changed. You can still edit the title, due date, grace period, and max attempts."
      );
    }
  }

  // If the due date is moving, it must still resolve to the future — same
  // rule as creation. (Leaving it unchanged is always allowed, even if the
  // original due date has already passed.)
  if (input.dueDate && input.dueDate.getTime() <= Date.now()) {
    throw new DomainError("CONFLICT", "Due date must be in the future.");
  }

  // Re-run the same "offering totals <= 100%" rule as create, but excluding
  // this assessment's own current weight from the "already used" total.
  if (input.weightPercentage !== undefined) {
    const existingWeight = await prisma.assessment.aggregate({
      where: {
        courseOfferingId: existing.courseOfferingId,
        deletedAt: null,
        id: { not: assessmentId },
      },
      _sum: { weightPercentage: true },
    });
    const currentTotal = Number(existingWeight._sum.weightPercentage ?? 0);
    const projectedTotal = currentTotal + input.weightPercentage;
    if (projectedTotal > 100) {
      throw new DomainError(
        "WEIGHT_EXCEEDED",
        `This would push the offering's total weighting to ${projectedTotal.toFixed(
          2
        )}%, over the 100% cap (currently ${currentTotal.toFixed(2)}% across other assessments).`
      );
    }
  }

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.weightPercentage !== undefined ? { weightPercentage: input.weightPercentage } : {}),
      ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: input.gracePeriodMinutes } : {}),
      ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
    },
  });
}

export async function deactivateAssessment(assessmentId: string, actingUser: SessionUser) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can deactivate assessments.");
  }

  const existing = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Assessment not found.");
  }

  // Soft delete: preserves existing submissions/grades for the record, just
  // hides the assessment from "create submission" / listing / weight-total
  // calculations going forward (all read paths already filter deletedAt: null).
  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { deletedAt: new Date() },
  });
}

export async function listAssessmentsForOffering(courseOfferingId: string) {
  return prisma.assessment.findMany({
    where: { courseOfferingId, deletedAt: null },
    orderBy: { dueDate: "asc" },
  });
}

/** Same as getAssessmentOr404, plus whether any current submission exists — used to lock
 * the grading-shape fields (type/weight/maxScore) on the edit form once students have submitted. */
export async function getAssessmentForEditOr404(assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: {
      courseOffering: { include: { course: true, academicYear: true } },
      submissions: { where: { isCurrent: true }, select: { id: true } },
    },
  });
  if (!assessment) {
    throw new DomainError("NOT_FOUND", "Assessment not found.");
  }
  const { submissions, ...rest } = assessment;
  return { ...rest, hasSubmissions: submissions.length > 0 };
}

export async function getAssessmentOr404(assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    include: {
      courseOffering: { include: { course: true, academicYear: true } },
    },
  });
  if (!assessment) {
    throw new DomainError("NOT_FOUND", "Assessment not found.");
  }
  return assessment;
}