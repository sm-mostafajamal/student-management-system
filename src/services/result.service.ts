import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import {
  EnrollmentStatus,
  Role,
  classifyScore,
  type MarksheetEntry,
  type PublishedResultView,
  type SessionUser,
} from "@/types";
import type {
  RecordGradeInput,
  PublishResultInput,
  UnpublishResultInput,
} from "@/lib/validations/result";

function requireStaff(actingUser: SessionUser) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can manage results.");
  }
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

// ─────────────────────────────────────────────
// STAFF: record / correct a grade
// ─────────────────────────────────────────────

export async function recordGrade(input: RecordGradeInput, actingUser: SessionUser) {
  requireStaff(actingUser);

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      courseOfferingId: input.courseOfferingId,
      status: EnrollmentStatus.ENROLLED,
    },
  });
  if (!enrollment) {
    throw new DomainError(
      "NOT_ENROLLED",
      "This student is not enrolled in the course offering."
    );
  }

  const existing = await prisma.grade.findUnique({
    where: {
      studentId_courseOfferingId: {
        studentId: input.studentId,
        courseOfferingId: input.courseOfferingId,
      },
    },
  });

  // First-ever entry for this student+offering — nothing to conflict with,
  // nothing to audit against. Always created unpublished; staff must
  // explicitly publish (see publishResult below).
  if (!existing) {
    return prisma.grade.create({
      data: {
        studentId: input.studentId,
        courseOfferingId: input.courseOfferingId,
        numericScore: input.numericScore,
        isPublished: false,
        computedById: actingUser.id,
        version: 1,
      },
    });
  }

  // Hidden case: changing a grade AFTER it was published. Require an
  // explicit reason and auto-unpublish — the corrected score is never
  // visible to the student until staff re-confirms it via publishResult.
  if (existing.isPublished && !input.reason) {
    throw new DomainError(
      "REASON_REQUIRED",
      "This result is already published. Provide a reason for the correction."
    );
  }

  const willUnpublish = existing.isPublished;

  // Hidden case: concurrent grade updates. The WHERE clause pins both id
  // AND version — if another staff member updated this row since the
  // client last read it, `expectedVersion` is stale and updateMany
  // touches zero rows. That's how we detect the race instead of silently
  // overwriting the other writer's change.
  const expectedVersion = input.expectedVersion ?? existing.version;
  const updateResult = await prisma.grade.updateMany({
    where: { id: existing.id, version: expectedVersion },
    data: {
      numericScore: input.numericScore,
      isPublished: willUnpublish ? false : existing.isPublished,
      publishedAt: willUnpublish ? null : existing.publishedAt,
      computedById: actingUser.id,
      version: { increment: 1 },
    },
  });

  if (updateResult.count === 0) {
    throw new DomainError(
      "CONFLICT",
      "This result was changed by someone else. Please refresh and try again."
    );
  }

  if (willUnpublish) {
    await prisma.gradeChangeLog.create({
      data: {
        gradeId: existing.id,
        previousNumericScore: existing.numericScore,
        newNumericScore: input.numericScore,
        previousIsPublished: true,
        newIsPublished: false,
        reason: input.reason!,
        changedById: actingUser.id,
      },
    });
  }

  return prisma.grade.findUniqueOrThrow({ where: { id: existing.id } });
}

// ─────────────────────────────────────────────
// STAFF: publish / unpublish
// ─────────────────────────────────────────────

export async function publishResult(input: PublishResultInput, actingUser: SessionUser) {
  requireStaff(actingUser);

  const grade = await prisma.grade.findUnique({ where: { id: input.gradeId } });
  if (!grade) {
    throw new DomainError("NOT_FOUND", "Result not found.");
  }
  if (grade.numericScore === null) {
    throw new DomainError(
      "REASON_REQUIRED",
      "Enter a numeric score before publishing this result."
    );
  }

  // Idempotent: publishing an already-published result is a harmless no-op
  // rather than an error — a double-click shouldn't produce a scary
  // conflict message for staff.
  if (grade.isPublished) {
    return grade;
  }

  const updateResult = await prisma.grade.updateMany({
    where: { id: input.gradeId, version: input.expectedVersion, isPublished: false },
    data: { isPublished: true, publishedAt: new Date(), version: { increment: 1 } },
  });

  if (updateResult.count === 0) {
    // Disambiguate: was it a genuine version conflict, or did someone else
    // publish it in the meantime (also fine, also idempotent)?
    const current = await prisma.grade.findUniqueOrThrow({ where: { id: input.gradeId } });
    if (current.isPublished) return current;
    throw new DomainError(
      "CONFLICT",
      "This result was changed by someone else. Please refresh and try again."
    );
  }

  await prisma.gradeChangeLog.create({
    data: {
      gradeId: input.gradeId,
      previousNumericScore: grade.numericScore,
      newNumericScore: grade.numericScore,
      previousIsPublished: false,
      newIsPublished: true,
      reason: "Published by staff.",
      changedById: actingUser.id,
    },
  });

  return prisma.grade.findUniqueOrThrow({ where: { id: input.gradeId } });
}

export async function unpublishResult(
  input: UnpublishResultInput,
  actingUser: SessionUser
) {
  requireStaff(actingUser);

  const grade = await prisma.grade.findUnique({ where: { id: input.gradeId } });
  if (!grade) {
    throw new DomainError("NOT_FOUND", "Result not found.");
  }

  // Hidden case: publish then un-publish. Idempotent in the same spirit as
  // publish — already-withheld is a no-op, not an error.
  if (!grade.isPublished) {
    return grade;
  }

  const updateResult = await prisma.grade.updateMany({
    where: { id: input.gradeId, version: input.expectedVersion, isPublished: true },
    data: { isPublished: false, publishedAt: null, version: { increment: 1 } },
  });

  if (updateResult.count === 0) {
    const current = await prisma.grade.findUniqueOrThrow({ where: { id: input.gradeId } });
    if (!current.isPublished) return current;
    throw new DomainError(
      "CONFLICT",
      "This result was changed by someone else. Please refresh and try again."
    );
  }

  await prisma.gradeChangeLog.create({
    data: {
      gradeId: input.gradeId,
      previousNumericScore: grade.numericScore,
      newNumericScore: grade.numericScore,
      previousIsPublished: true,
      newIsPublished: false,
      reason: input.reason,
      changedById: actingUser.id,
    },
  });

  return prisma.grade.findUniqueOrThrow({ where: { id: input.gradeId } });
}

// ─────────────────────────────────────────────
// STAFF: marksheet view (all enrolled students, graded or not)
// ─────────────────────────────────────────────

export async function getMarksheetForCourseOffering(
  courseOfferingId: string,
  actingUser: SessionUser
): Promise<MarksheetEntry[]> {
  requireStaff(actingUser);

  const enrollments = await prisma.enrollment.findMany({
    where: { courseOfferingId, status: EnrollmentStatus.ENROLLED },
    include: { student: { include: { user: true } } },
    orderBy: { student: { studentNumber: "asc" } },
  });

  const grades = await prisma.grade.findMany({
    where: { courseOfferingId, studentId: { in: enrollments.map((e) => e.studentId) } },
  });
  const gradeByStudentId = new Map(grades.map((g) => [g.studentId, g]));

  return enrollments.map((enrollment): MarksheetEntry => {
    const grade = gradeByStudentId.get(enrollment.studentId) ?? null;
    const numericScore = grade?.numericScore != null ? toNumber(grade.numericScore) : null;

    return {
      studentId: enrollment.studentId,
      studentNumber: enrollment.student.studentNumber,
      studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
      gradeId: grade?.id ?? null,
      numericScore,
      classification: numericScore !== null ? classifyScore(numericScore) : null,
      isPublished: grade?.isPublished ?? false,
      version: grade?.version ?? null,
    };
  });
}

// ─────────────────────────────────────────────
// STUDENT: published-only access
// ─────────────────────────────────────────────

/// Hidden case: student trying to access an unpublished result. Whether
/// there's genuinely no grade yet, or a grade exists but is withheld, the
/// student gets the exact same NOT_FOUND — the distinction is not
/// observable from the student side by design.
export async function getStudentPublishedResults(
  studentId: string
): Promise<PublishedResultView[]> {
  const grades = await prisma.grade.findMany({
    where: { studentId, isPublished: true, numericScore: { not: null } },
    include: { courseOffering: { include: { course: true } } },
    orderBy: { publishedAt: "desc" },
  });

  return grades.map((grade) => {
    const numericScore = toNumber(grade.numericScore);
    return {
      gradeId: grade.id,
      courseCode: grade.courseOffering.course.code,
      courseTitle: grade.courseOffering.course.title,
      numericScore,
      classification: classifyScore(numericScore),
      publishedAt: grade.publishedAt,
    };
  });
}

export async function getStudentPublishedResult(
  gradeId: string,
  studentId: string
): Promise<PublishedResultView> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: { courseOffering: { include: { course: true } } },
  });

  if (
    !grade ||
    grade.studentId !== studentId ||
    !grade.isPublished ||
    grade.numericScore === null
  ) {
    throw new DomainError("NOT_FOUND", "Result not available.");
  }

  const numericScore = toNumber(grade.numericScore);
  return {
    gradeId: grade.id,
    courseCode: grade.courseOffering.course.code,
    courseTitle: grade.courseOffering.course.title,
    numericScore,
    classification: classifyScore(numericScore),
    publishedAt: grade.publishedAt,
  };
}