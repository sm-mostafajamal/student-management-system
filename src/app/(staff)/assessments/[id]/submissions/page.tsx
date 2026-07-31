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

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
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
                File
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
                <td className="px-4 py-2">
                  <Link
                    href={`/api/submissions/${s.id}/file`}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Download
                  </Link>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
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