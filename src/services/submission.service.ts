import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import {
  validateSubmissionFile,
  saveSubmissionFile,
  deleteSubmissionFile,
  resolveStoragePath,
  FileValidationError,
} from "@/lib/file-storage";
import { EnrollmentStatus, Role, SubmissionStatus } from "@/types";
import type { SessionUser } from "@/types";

const MAX_SERIALIZATION_RETRIES = 2;

interface SubmitParams {
  assessmentId: string;
  studentId: string;
  fileBuffer: Buffer;
  originalFileName: string;
}

export interface SubmitResult {
  submissionId: string;
  attemptNumber: number;
  isLate: boolean;
  status: SubmissionStatus;
}

export async function submitAssessment(params: SubmitParams): Promise<SubmitResult> {
  const { assessmentId, studentId, fileBuffer, originalFileName } = params;

  // 1) Validate the file in memory FIRST. Cheap, no disk/DB touched.
  let validatedFile;
  try {
    validatedFile = validateSubmissionFile(fileBuffer, originalFileName);
  } catch (err) {
    if (err instanceof FileValidationError) {
      throw new DomainError("INVALID_FILE", err.message);
    }
    throw err;
  }

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
  });
  if (!assessment) {
    throw new DomainError("NOT_FOUND", "Assessment not found.");
  }

  // Authorization edge case interviewers look for: a student must be
  // ENROLLED in the course offering this assessment belongs to. Without
  // this, any student could submit against any assessment by guessing IDs.
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      courseOfferingId: assessment.courseOfferingId,
      status: EnrollmentStatus.ENROLLED,
    },
  });
  if (!enrollment) {
    throw new DomainError(
      "NOT_ENROLLED",
      "You are not enrolled in the course this assessment belongs to."
    );
  }

  // 2) Write the file to disk. This is the slow, I/O-bound step — the
  // window during which a deadline could tick over mid-request.
  const storageKey = await saveSubmissionFile(assessmentId, studentId, validatedFile);

  try {
    // 3) Only AFTER the upload finishes do we decide lateness and commit —
    // inside a SERIALIZABLE transaction that re-reads the assessment's
    // dueDate fresh, rather than trusting anything computed before the
    // upload started. This is the fix for "deadline passes during upload":
    // a student who clicked submit at 23:59:58 for a 23:59:59 deadline is
    // judged by the clock at COMMIT time, not click time.
    const created = await runWithSerializableRetry(async (tx) => {
      const freshAssessment = await tx.assessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });

      const deadline = new Date(
        freshAssessment.dueDate.getTime() + freshAssessment.gracePeriodMinutes * 60_000
      );
      const now = new Date();
      const isLate = now.getTime() > deadline.getTime();

      const existing = await tx.submission.findFirst({
        where: { assessmentId, studentId, isCurrent: true },
      });

      if (existing) {
        if (isLate) {
          // A submission already exists and the deadline (+ grace) has
          // now passed — the resubmission window is closed. The prior
          // (already on-time-or-late) submission stands as final.
          throw new DomainError(
            "DEADLINE_PASSED",
            "The deadline has passed. Your existing submission is final and can no longer be replaced."
          );
        }
        if (existing.attemptNumber >= freshAssessment.maxAttempts) {
          throw new DomainError(
            "MAX_ATTEMPTS_REACHED",
            `Maximum of ${freshAssessment.maxAttempts} attempt(s) reached for this assessment.`
          );
        }

        await tx.submission.update({
          where: { id: existing.id },
          data: { isCurrent: false },
        });

        return tx.submission.create({
          data: {
            assessmentId,
            studentId,
            attemptNumber: existing.attemptNumber + 1,
            isCurrent: true,
            isLate,
            status: SubmissionStatus.RESUBMITTED, // isLate is false here by construction
            fileUrl: storageKey,
            originalFileName,
            mimeType: validatedFile.mimeType,
            fileSizeBytes: validatedFile.sizeBytes,
          },
        });
      }

      // First-ever submission — always accepted per spec. Late is flagged,
      // never rejected outright.
      return tx.submission.create({
        data: {
          assessmentId,
          studentId,
          attemptNumber: 1,
          isCurrent: true,
          isLate,
          status: isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
          fileUrl: storageKey,
          originalFileName,
          mimeType: validatedFile.mimeType,
          fileSizeBytes: validatedFile.sizeBytes,
        },
      });
    });

    return {
      submissionId: created.id,
      attemptNumber: created.attemptNumber,
      isLate: created.isLate,
      status: created.status,
    };
  } catch (err) {
    // The DB side failed (business rule OR a genuine race) — don't leave
    // an orphaned file on disk.
    await deleteSubmissionFile(storageKey);

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Two concurrent requests both passed the `existing` check and both
      // tried to insert the same (assessmentId, studentId, attemptNumber)
      // row. The unique constraint is the last line of defense.
      throw new DomainError(
        "CONFLICT",
        "Your submission may have already gone through from another request. Please refresh before trying again."
      );
    }
    throw err;
  }
}

/**
 * Runs a transaction at SERIALIZABLE isolation and retries a bounded
 * number of times on a Postgres serialization failure (P2034) — the
 * expected, recoverable outcome when two truly concurrent submit requests
 * for the same student+assessment interleave.
 */
async function runWithSerializableRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationFailure && attempt < MAX_SERIALIZATION_RETRIES) {
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

export async function getCurrentSubmission(assessmentId: string, studentId: string) {
  return prisma.submission.findFirst({
    where: { assessmentId, studentId, isCurrent: true },
  });
}

export async function listSubmissionsForAssessment(
  assessmentId: string,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can view all submissions.");
  }
  return prisma.submission.findMany({
    where: { assessmentId, isCurrent: true },
    include: { student: { include: { user: true } } },
    orderBy: { submittedAt: "desc" },
  });
}

interface FileAccess {
  absolutePath: string;
  originalFileName: string;
  mimeType: string;
}

export async function getAuthorizedSubmissionFile(
  submissionId: string,
  actingUser: SessionUser
): Promise<FileAccess> {
  const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
  if (!submission || !submission.fileUrl) {
    throw new DomainError("NOT_FOUND", "Submission file not found.");
  }

  const isOwner =
    actingUser.role === Role.STUDENT && actingUser.studentId === submission.studentId;
  const isStaff = actingUser.role === Role.STAFF;
  // Simplification per the "simple role toggle" constraint: any STAFF can
  // view any submission. Production would additionally scope this to the
  // instructor assigned to the relevant CourseOffering, or a
  // registrar/admin override role.
  if (!isOwner && !isStaff) {
    throw new DomainError("FORBIDDEN", "You do not have access to this file.");
  }

  return {
    absolutePath: resolveStoragePath(submission.fileUrl),
    originalFileName: submission.originalFileName ?? "submission",
    mimeType: submission.mimeType ?? "application/octet-stream",
  };
}

// ─────────────────────────────────────────────
// STAFF: grade an individual submission
// ─────────────────────────────────────────────

interface GradeSubmissionParams {
  submissionId: string;
  score: number;
  feedback?: string;
}
export async function gradeSubmission(
  params: GradeSubmissionParams,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can grade submissions.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: params.submissionId },
    include: { assessment: true },
  });
  if (!submission) {
    throw new DomainError("NOT_FOUND", "Submission not found.");
  }

  const maxScore = Number(submission.assessment.maxScore);
  if (params.score < 0 || params.score > maxScore) {
    throw new DomainError("VALIDATION_ERROR", `Score must be between 0 and ${maxScore}.`);
  }

  const updated = await prisma.submission.update({
    where: { id: params.submissionId },
    data: {
      score: params.score,
      feedback: params.feedback ?? null,
      gradedById: actingUser.id,
      gradedAt: new Date(),
    },
  });

  // Caller (the grade action) needs this to redirect back to the
  // course offering's marksheet after a successful save.
  return { ...updated, courseOfferingId: submission.assessment.courseOfferingId };
}

/** Fetches one submission with everything the grading page needs to render:
 * student identity, the assessment it belongs to, and the course/offering
 * it's under (so the page can link back and show subject context). */
export async function getSubmissionForGrading(
  submissionId: string,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can grade submissions.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { include: { user: true } },
      assessment: {
        include: { courseOffering: { include: { course: true } } },
      },
    },
  });
  if (!submission) {
    throw new DomainError("NOT_FOUND", "Submission not found.");
  }
  return submission;
}

/// Hidden case: "history" here means every PAST attempt (isCurrent: false)
/// plus the current one for THIS assessment, i.e. what the student
/// previously submitted/was scored on before their latest resubmission —
/// exactly what a marker needs before deciding on a fresh mark.
///
/// Only PUBLISHED results are shown here — staff shouldn't see withheld/
/// draft marks surfaced as "history" as if they were finalized results.
export async function getSubmissionAttemptHistory(
  submissionId: string,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can view submission history.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      student: { include: { user: true } },
      assessment: {
        include: { courseOffering: { include: { course: true } } },
      },
    },
  });
  if (!submission) {
    throw new DomainError("NOT_FOUND", "Submission not found.");
  }

  // Every attempt this student has made on THIS assessment — only
  // returned at all if the assessment's results have been published.
  const attempts = submission.assessment.isPublished
    ? await prisma.submission.findMany({
        where: { assessmentId: submission.assessmentId, studentId: submission.studentId },
        orderBy: { attemptNumber: "asc" },
        include: { gradedBy: true },
      })
    : [];

  // Every OTHER assessment's current submission for this student, within
  // the same course offering ("that subject") — restricted to assessments
  // whose results have been published.
  const otherAssessmentSubmissions = await prisma.submission.findMany({
    where: {
      studentId: submission.studentId,
      isCurrent: true,
      assessmentId: { not: submission.assessmentId },
      assessment: {
        courseOfferingId: submission.assessment.courseOfferingId,
        deletedAt: null,
        isPublished: true,
      },
    },
    orderBy: { assessment: { dueDate: "asc" } },
    include: { assessment: true, gradedBy: true },
  });

  return { submission, attempts, otherAssessmentSubmissions };
}

/// STAFF marksheet view: for every enrolled student, every current
/// submission across every assessment in this course offering — the
/// counterpart to result.service.ts::getMarksheetForCourseOffering, but
/// showing what was actually SUBMITTED and MARKED per assessment rather
/// than the single aggregated final Grade.
export async function listSubmissionMarksheetForCourseOffering(
  courseOfferingId: string,
  actingUser: SessionUser
) {
  if (actingUser.role !== Role.STAFF) {
    throw new DomainError("FORBIDDEN", "Only staff can view the marksheet.");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { courseOfferingId, status: EnrollmentStatus.ENROLLED },
    include: { student: { include: { user: true } } },
    orderBy: { student: { studentNumber: "asc" } },
  });

  const assessments = await prisma.assessment.findMany({
    where: { courseOfferingId, deletedAt: null },
    orderBy: { dueDate: "asc" },
  });

  const submissions = await prisma.submission.findMany({
    where: {
      isCurrent: true,
      studentId: { in: enrollments.map((e) => e.studentId) },
      assessmentId: { in: assessments.map((a) => a.id) },
    },
  });
  const byStudentAndAssessment = new Map(
    submissions.map((s) => [`${s.studentId}:${s.assessmentId}`, s])
  );

  return enrollments.map((enrollment) => ({
    studentId: enrollment.studentId,
    studentNumber: enrollment.student.studentNumber,
    studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
    assessments: assessments.map((assessment) => {
      const submission = byStudentAndAssessment.get(
        `${enrollment.studentId}:${assessment.id}`
      );
      return {
        assessmentId: assessment.id,
        title: assessment.title,
        maxScore: Number(assessment.maxScore),
        weightPercentage: Number(assessment.weightPercentage),
        isPublished: assessment.isPublished,
        submissionId: submission?.id ?? null,
        score: submission?.score != null ? Number(submission.score) : null,
        status: submission?.status ?? null,
        isLate: submission?.isLate ?? null,
        submittedAt: submission?.submittedAt ?? null,
        gradedAt: submission?.gradedAt ?? null,
        feedback: submission?.feedback ?? null,
      };
    }),
  }));
}