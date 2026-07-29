import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getAssessmentOr404 } from "@/services/assessment.service";
import { getCurrentSubmission } from "@/services/submission.service";
import { SubmissionForm } from "@/components/submissions/SubmissionForm";
import { LateBadge } from "@/components/submissions/LateBadge";
import { Role } from "@/types";

export default async function StudentAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) {
    redirect("/");
  }

  const assessment = await getAssessmentOr404(id).catch(() => null);
  if (!assessment) {
    notFound();
  }

  const submission = await getCurrentSubmission(id, user.studentId);
  const deadline = new Date(
    assessment.dueDate.getTime() + assessment.gracePeriodMinutes * 60_000
  );
  const isPastDeadline = Date.now() > deadline.getTime();

  // This mirrors the server-side rule in submission.service.ts for UX
  // purposes only — the service re-validates everything authoritatively
  // regardless of what this page shows or hides.
  const canSubmit = submission
    ? !isPastDeadline && submission.attemptNumber < assessment.maxAttempts
    : true;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {assessment.title}
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {assessment.courseOffering.course.code} · Due {assessment.dueDate.toLocaleString()}
        {assessment.gracePeriodMinutes > 0 && ` (+${assessment.gracePeriodMinutes}m grace)`}
      </p>

      {submission && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Current submission (attempt {submission.attemptNumber})
            </p>
            <LateBadge isLate={submission.isLate} />
          </div>
          <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
            {submission.originalFileName}
          </p>
          <a
            href={`/api/submissions/${submission.id}/file`}
            className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Download my file
          </a>
        </div>
      )}

      <div className="mt-6">
        {canSubmit ? (
          <SubmissionForm assessmentId={id} hasExisting={Boolean(submission)} />
        ) : (
          <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            {isPastDeadline
              ? "The deadline has passed. Your existing submission is final and can no longer be replaced."
              : "You have used all available attempts for this assessment."}
          </p>
        )}
      </div>
    </main>
  );
}