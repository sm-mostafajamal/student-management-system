/**
 * Grade domain service.
 *
 * Key rules:
 * - Grade is distinct from Submission scores. Grade is the FINAL course grade.
 * - Once published (isPublished=true), any change MUST produce a GradeChangeLog.
 * - GPA is computed at read time — never cached in the DB (see student.service.ts).
 * - isLate on Submission is computed ONCE at submission time and never updated.
 */

import prisma from "@/lib/prisma";
import { ok, fail, assertFound, AppError } from "@/lib/errors";
import { toNumber, fromNumber } from "@/lib/decimal";
import { GPA_SCALE } from "@/types";
import type { ApiResult, GradeWithHistory } from "@/types";
import { LetterGrade } from "@prisma/client";
import { z } from "zod";

// ─── Validation schemas ───────────────────────────────────────────────────────

export const UpsertGradeSchema = z.object({
  studentId: z.string().cuid(),
  courseOfferingId: z.string().cuid(),
  numericScore: z.number().min(0).max(100).optional(),
  letterGrade: z.nativeEnum(LetterGrade).optional(),
  computedById: z.string().cuid(),
  changeReason: z.string().min(5).optional(), // required only when changing a published grade
});

export type UpsertGradeInput = z.infer<typeof UpsertGradeSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Infers LetterGrade from a numeric score using a standard scale.
 * Adjust thresholds here if PEN Global uses a different grading policy.
 */
export function numericToLetterGrade(score: number): LetterGrade {
  if (score >= 97) return "A_PLUS";
  if (score >= 93) return "A";
  if (score >= 90) return "A_MINUS";
  if (score >= 87) return "B_PLUS";
  if (score >= 83) return "B";
  if (score >= 80) return "B_MINUS";
  if (score >= 77) return "C_PLUS";
  if (score >= 73) return "C";
  if (score >= 70) return "C_MINUS";
  if (score >= 67) return "D_PLUS";
  if (score >= 60) return "D";
  return "F";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates or updates a grade for a student in a course offering.
 * If the grade was already published, requires changeReason and writes
 * a GradeChangeLog entry — enforced here, not in the DB.
 */
export async function upsertGrade(
  input: UpsertGradeInput
): Promise<ApiResult<GradeWithHistory>> {
  try {
    const parsed = UpsertGradeSchema.parse(input);

    // Auto-infer letterGrade from numericScore if not provided
    const letterGrade: LetterGrade | undefined =
      parsed.letterGrade ??
      (parsed.numericScore != null
        ? numericToLetterGrade(parsed.numericScore)
        : undefined);

    const gpaPoints =
      letterGrade != null ? GPA_SCALE[letterGrade] : undefined;

    const existing = await prisma.grade.findUnique({
      where: {
        studentId_courseOfferingId: {
          studentId: parsed.studentId,
          courseOfferingId: parsed.courseOfferingId,
        },
      },
    });

    if (existing?.isPublished) {
      if (!parsed.changeReason) {
        throw new AppError(
          "VALIDATION_ERROR",
          "A reason is required when changing a published grade"
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.gradeChangeLog.create({
          data: {
            gradeId: existing.id,
            previousNumericScore: existing.numericScore,
            previousLetterGrade: existing.letterGrade,
            previousGpaPoints: existing.gpaPoints,
            previousIsPublished: existing.isPublished, // = true, since this branch only runs when existing.isPublished is true
            newNumericScore:
              parsed.numericScore != null
                ? fromNumber(parsed.numericScore)
                : null,
            newLetterGrade: letterGrade ?? null,
            newGpaPoints: gpaPoints != null ? fromNumber(gpaPoints) : null,
            newIsPublished: existing.isPublished, // unchanged — this function doesn't alter publish status
            reason: parsed.changeReason!,
            changedById: parsed.computedById,
          },
        });

        return tx.grade.update({
          where: { id: existing.id },
          data: {
            numericScore:
              parsed.numericScore != null
                ? fromNumber(parsed.numericScore)
                : undefined,
            letterGrade: letterGrade ?? undefined,
            gpaPoints: gpaPoints != null ? fromNumber(gpaPoints) : undefined,
            computedById: parsed.computedById,
          },
          include: { changeLogs: { include: { changedBy: true } } },
        });
      });

      return ok(updated);
    }

    // Create or update (unpublished grade — no audit log needed)
    const grade = await prisma.grade.upsert({
      where: {
        studentId_courseOfferingId: {
          studentId: parsed.studentId,
          courseOfferingId: parsed.courseOfferingId,
        },
      },
      create: {
        studentId: parsed.studentId,
        courseOfferingId: parsed.courseOfferingId,
        numericScore:
          parsed.numericScore != null ? fromNumber(parsed.numericScore) : null,
        letterGrade: letterGrade ?? null,
        gpaPoints: gpaPoints != null ? fromNumber(gpaPoints) : null,
        computedById: parsed.computedById,
      },
      update: {
        numericScore:
          parsed.numericScore != null ? fromNumber(parsed.numericScore) : null,
        letterGrade: letterGrade ?? null,
        gpaPoints: gpaPoints != null ? fromNumber(gpaPoints) : null,
        computedById: parsed.computedById,
      },
      include: { changeLogs: { include: { changedBy: true } } },
    });

    return ok(grade);
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[GradeService.upsertGrade]", err);
    return fail("Failed to save grade");
  }
}

/**
 * Publishes grades for an entire course offering in a single operation.
 * Rejects if any student in the offering has no grade record.
 */
export async function publishGradesForOffering(
  courseOfferingId: string,
  publishedById: string
): Promise<ApiResult<{ published: number }>> {
  try {
    const enrolledStudentIds = await prisma.enrollment.findMany({
      where: { courseOfferingId, status: "ENROLLED" },
      select: { studentId: true },
    });

    const gradedStudentIds = await prisma.grade.findMany({
      where: { courseOfferingId },
      select: { studentId: true },
    });

    const gradedSet = new Set(gradedStudentIds.map((g) => g.studentId));
    const ungradedStudents = enrolledStudentIds.filter(
      (e) => !gradedSet.has(e.studentId)
    );

    if (ungradedStudents.length > 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `${ungradedStudents.length} enrolled student(s) have no grade — cannot publish until all are graded`
      );
    }

    const result = await prisma.grade.updateMany({
      where: { courseOfferingId, isPublished: false },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    return ok({ published: result.count });
  } catch (err) {
    if (err instanceof AppError) return err.toApiResult() as ApiResult<never>;
    console.error("[GradeService.publishGradesForOffering]", err);
    return fail("Failed to publish grades");
  }
}

/**
 * Returns published grades for a student (what the student sees).
 */
export async function getStudentGrades(
  studentId: string,
  academicYearId?: string
): Promise<ApiResult<GradeWithHistory[]>> {
  try {
    const grades = await prisma.grade.findMany({
      where: {
        studentId,
        isPublished: true,
        ...(academicYearId
          ? { courseOffering: { academicYearId } }
          : {}),
      },
      include: {
        changeLogs: { include: { changedBy: true } },
      },
      orderBy: { publishedAt: "desc" },
    });

    return ok(grades);
  } catch (err) {
    console.error("[GradeService.getStudentGrades]", err);
    return fail("Failed to fetch grades");
  }
}