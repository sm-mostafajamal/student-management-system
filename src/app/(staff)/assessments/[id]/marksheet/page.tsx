import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMarksheetForCourseOffering } from "@/services/result.service";
import { listSubmissionMarksheetForCourseOffering } from "@/services/submission.service";
import { ClassificationBadge } from "@/components/results/ClassificationBadge";
import { RecordGradeForm } from "@/components/results/RecordGradeForm";
import { PublishToggle } from "@/components/results/PublishToggle";
import { Role } from "@/types";

export default async function MarksheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseOfferingId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    redirect("/");
  }
  const [entries, submissionMarksheet] = await Promise.all([
    getMarksheetForCourseOffering(courseOfferingId, user),
    listSubmissionMarksheetForCourseOffering(courseOfferingId, user),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/assessments"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to assessments
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Marksheet</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {entries.length} enrolled student(s). Only published final results are visible to students.
      </p>

      {/* ── Submitted assessment marks ───────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Submitted assessment marks
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          What each student has actually submitted and been marked on, per assessment.
        </p>

        {submissionMarksheet.length === 0 || submissionMarksheet[0].assessments.length === 0 ? (
          <p className="mt-3 rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            No assessments have been created for this course offering yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Student
                  </th>
                  {submissionMarksheet[0].assessments.map((a) => (
                    <th
                      key={a.assessmentId}
                      className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    >
                      {a.title}
                      <span className="block font-normal normal-case text-gray-400">
                        /{a.maxScore} · {a.weightPercentage}%
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950">
                {submissionMarksheet.map((row) => (
                  <tr key={row.studentId}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {row.studentName}
                      <span className="ml-2 text-xs text-gray-400">{row.studentNumber}</span>
                    </td>
                    {row.assessments.map((a) => (
                      <td key={a.assessmentId} className="px-4 py-2 text-sm">
                        {a.submissionId ? (
                          <div>
                            <span className="text-gray-900 dark:text-gray-100">
                              {a.score != null ? `${a.score} / ${a.maxScore}` : "Not graded"}
                            </span>
                            {a.isLate && (
                              <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                                (late)
                              </span>
                            )}
                            <div className="mt-1 flex gap-2">
                              {(!a.isPublished || a.score == null) && (
                                <Link
                                  href={`/assessments/${a.assessmentId}/submissions/${a.submissionId}/grade`}
                                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                  Mark
                                </Link>
                              )}
                              <Link
                                href={`/assessments/${a.assessmentId}/submissions/${a.submissionId}/history`}
                                className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
                              >
                                History
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not submitted</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Final course grade
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          The overall result for this course, set independently of individual assessment marks above.
        </p>

        <div className="mt-3 space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.studentId}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.studentName}
                    <span className="ml-2 text-xs text-gray-400">{entry.studentNumber}</span>
                  </p>
                  {entry.classification && (
                    <div className="mt-1 flex items-center gap-2">
                      <ClassificationBadge classification={entry.classification} />
                      <span
                        className={`text-xs font-medium ${
                          entry.isPublished
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {entry.isPublished ? "Published" : "Withheld"}
                      </span>
                    </div>
                  )}
                </div>

                {entry.gradeId && (
                  <PublishToggle
                    gradeId={entry.gradeId}
                    isPublished={entry.isPublished}
                    version={entry.version ?? 1}
                  />
                )}
              </div>

              <div className="mt-3">
                <RecordGradeForm
                  studentId={entry.studentId}
                  courseOfferingId={courseOfferingId}
                  currentScore={entry.numericScore}
                  isPublished={entry.isPublished}
                  version={entry.version}
                />
              </div>
            </div>
          ))}

          {entries.length === 0 && (
            <p className="rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              No enrolled students in this course offering yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}