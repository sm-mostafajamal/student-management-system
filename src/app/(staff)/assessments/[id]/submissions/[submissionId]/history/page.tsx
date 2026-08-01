import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getSubmissionAttemptHistory } from "@/services/submission.service";
import { DomainError } from "@/lib/errors";
import { LateBadge } from "@/components/submissions/LateBadge";
import { Role } from "@/types";

export default async function SubmissionHistoryPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id: assessmentId, submissionId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    redirect("/");
  }

  const data = await getSubmissionAttemptHistory(submissionId, user).catch((err) => {
    if (err instanceof DomainError && err.code === "NOT_FOUND") return null;
    throw err;
  });

  if (!data || data.submission.assessmentId !== assessmentId) {
    notFound();
  }

  const { submission, attempts, otherAssessmentSubmissions } = data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href={`/assessments/${assessmentId}/submissions/${submissionId}/grade`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to marking
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        History — {submission.student.user.firstName} {submission.student.user.lastName}
        <span className="ml-2 text-sm font-normal text-gray-400">
          {submission.student.studentNumber}
        </span>
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {submission.assessment.courseOffering.course.code} —{" "}
        {submission.assessment.courseOffering.course.title}
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Previous attempts — {submission.assessment.title}
        </h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Attempt</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Submitted</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Graded by</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {attempts.map((a) => (
                <tr key={a.id} className={a.id === submission.id ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                    #{a.attemptNumber} {a.isCurrent && <span className="ml-1 text-xs text-emerald-600">(current)</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {a.submittedAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-2"><LateBadge isLate={a.isLate} /></td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                    {a.score != null ? `${Number(a.score)} / ${Number(submission.assessment.maxScore)}` : "Not graded"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {a.gradedBy ? `${a.gradedBy.firstName} ${a.gradedBy.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    {a.feedback ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Other assessments in this subject
        </h2>
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Assessment</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Submitted</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {otherAssessmentSubmissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{s.assessment.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{s.submittedAt.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                    {s.score != null ? `${Number(s.score)} / ${Number(s.assessment.maxScore)}` : "Not graded"}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{s.feedback ?? "—"}</td>
                </tr>
              ))}
              {otherAssessmentSubmissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No submissions for other assessments in this subject yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}