import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getStudentResults } from "@/services/result.service";
import { ClassificationBadge } from "@/components/results/ClassificationBadge";
import { Role } from "@/types";

export default async function StudentResultsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) {
    redirect("/");
  }

  const results = await getStudentResults(user.studentId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Results</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Results your registry is still finalizing show as "Withheld" until published.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Course
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Score
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Classification
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
            {results.map((r) => (
              <tr key={r.gradeId}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <span className="font-medium">{r.courseCode}</span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">{r.courseTitle}</span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                  {r.numericScore !== null ? r.numericScore.toFixed(2) : "—"}
                </td>
                <td className="px-4 py-2">
                  {r.classification ? (
                    <ClassificationBadge classification={r.classification} />
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.status === "PUBLISHED" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Withheld
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  No results recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}