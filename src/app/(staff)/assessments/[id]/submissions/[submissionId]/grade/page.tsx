import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getSubmissionForGrading } from "@/services/submission.service";
import { DomainError } from "@/lib/errors";
import { LateBadge } from "@/components/submissions/LateBadge";
import { MarkSubmissionForm } from "@/components/submissions/MarkSubmissionForm";
import { Role } from "@/types";

export default async function GradeSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id: assessmentId, submissionId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    redirect("/");
  }

  const submission = await getSubmissionForGrading(submissionId, user).catch((err) => {
    if (err instanceof DomainError && err.code === "NOT_FOUND") return null;
    throw err;
  });

  if (!submission || submission.assessmentId !== assessmentId) {
    notFound();
  }

  const maxScore = Number(submission.assessment.maxScore);
  const currentScore = submission.score != null ? Number(submission.score) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/assessments/${assessmentId}/submissions`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to submissions
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Mark submission
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {submission.assessment.title} · {submission.assessment.courseOffering.course.code}
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {submission.student.user.firstName} {submission.student.user.lastName}
              <span className="ml-2 text-xs text-gray-400">
                {submission.student.studentNumber}
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Attempt {submission.attemptNumber} · Submitted{" "}
              {submission.submittedAt.toLocaleString()}
            </p>
          </div>
          <LateBadge isLate={submission.isLate} />
        </div>

        {submission.fileUrl && (
          <Link
            href={`/api/submissions/${submission.id}/file`}
            className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Download submitted file
          </Link>
        )}

        <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
          <MarkSubmissionForm
            submissionId={submission.id}
            assessmentId={assessmentId}
            maxScore={maxScore}
            currentScore={currentScore}
            currentFeedback={submission.feedback}
          />
        </div>
      </div>

      <Link
        href={`/assessments/${assessmentId}/submissions/${submissionId}/history`}
        className="mt-4 inline-block text-sm font-medium text-gray-600 hover:underline dark:text-gray-400"
      >
        View this student's previous results for this subject →
      </Link>
    </main>
  );
}