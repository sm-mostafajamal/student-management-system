import { z } from "zod";
import { AssessmentType } from "@/types";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { Role } from "@/types";
import type { CreateAssessmentInput } from "@/lib/validations/assessment-submission";
import type { SessionUser } from "@/types";

export const createAssessmentSchema = z
  .object({
    courseOfferingId: z.string().cuid(),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
    type: z.nativeEnum(AssessmentType),
    weightPercentage: z.coerce.number().min(0).max(100),
    maxScore: z.coerce.number().positive(),
    dueDate: z.coerce.date(),
    gracePeriodMinutes: z.coerce.number().int().min(0).max(24 * 60).default(0),
    maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  })
  .refine((data) => data.dueDate.getTime() > Date.now(), {
    message: "Due date must be in the future.",
    path: ["dueDate"],
  });

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const submitAssessmentSchema = z.object({
  assessmentId: z.string().cuid(),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;


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
export async function listAssessmentsForOffering(courseOfferingId: string) {
  return prisma.assessment.findMany({
    where: { courseOfferingId, deletedAt: null },
    orderBy: { dueDate: "asc" },
  });
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