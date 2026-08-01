import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getAssessmentOr404 } from "@/services/assessment.service";
import { listSubmissionsForAssessment } from "@/services/submission.service";
import { LateBadge } from "@/components/submissions/LateBadge";
import { Role } from "@/types";
import Link from "next/link";

export default async function AssessmentSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    redirect("/");
  }

  const assessment = await getAssessmentOr404(id).catch(() => null);
  if (!assessment) {
    notFound();
  }

  const submissions = await listSubmissionsForAssessment(id, user);
  const maxScore = Number(assessment.maxScore);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/assessments"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400 pb-4"
      >
        ← Back to assessments
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {assessment.title} — Submissions
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Due {assessment.dueDate.toLocaleString()} · {submissions.length} submission(s)
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Student
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Attempt
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Submitted
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Marks
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                File
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
            {submissions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {s.student.user.firstName} {s.student.user.lastName}
                  <span className="ml-2 text-xs text-gray-400">{s.student.studentNumber}</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {s.attemptNumber}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {s.submittedAt.toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <LateBadge isLate={s.isLate} />
                </td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {s.score != null ? (
                    `${Number(s.score)} / ${maxScore}`
                  ) : (
                    <span className="text-gray-400">Not graded</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/api/submissions/${s.id}/file`}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Download
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-3">
                    {(!assessment.isPublished || s.score == null) ? (
                      <Link
                        href={`/assessments/${id}/submissions/${s.id}/grade`}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
                      >
                        Mark
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        Published
                      </span>
                    )}
                    <Link
                      href={`/assessments/${id}/submissions/${s.id}/history`}
                      className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    >
                      History
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}