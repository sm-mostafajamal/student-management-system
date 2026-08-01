import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { listSubmissionMarksheetForCourseOffering } from "@/services/submission.service";
import { ClassificationBadge } from "@/components/results/ClassificationBadge";
import { RecordGradeForm } from "@/components/results/RecordGradeForm";
import { PublishToggle } from "@/components/results/PublishToggle";
import { Role } from "@/types";
import { getMarksheetForCourseOffering, computeFinalGradeFromAssessments } from "@/services/result.service";

export const dynamic = "force-dynamic";

export default async function CourseOfferingMarksheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseOfferingId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");

  const [entries, submissionMarksheet] = await Promise.all([
    getMarksheetForCourseOffering(courseOfferingId, user),
    listSubmissionMarksheetForCourseOffering(courseOfferingId, user),
  ]);

  const submissionsByStudent = new Map(submissionMarksheet.map((row) => [row.studentId, row]));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/grades"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to grades
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Course Marksheet</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {entries.length} enrolled student(s). Each student below lists every assessment in this
        course, plus their overall published/withheld final result.
      </p>

      <div className="mt-8 space-y-6">
        {entries.map((entry) => {
          const submissionRow = submissionsByStudent.get(entry.studentId);
          const computed = computeFinalGradeFromAssessments(submissionRow?.assessments ?? []);
          return (
            <section
              key={entry.studentId}
              className="rounded-xl border border-gray-200 dark:border-gray-800"
            >
              {/* ── Student header ─────────────────────────── */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {entry.studentName}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {entry.studentNumber}
                    </span>
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

              {/* ── This student's assessments, in a section ─── */}
              <div className="px-4 py-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Assessments
                </h3>
                {!submissionRow || submissionRow.assessments.length === 0 ? (
                  <p className="text-sm text-gray-400">No assessments created for this course yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {submissionRow.assessments.map((a) => (
                      <li key={a.assessmentId} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{a.title}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            /{a.maxScore} · {a.weightPercentage}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {a.submissionId ? (
                            <>
                              <span className="text-gray-700 dark:text-gray-300">
                                {a.score != null ? `${a.score} / ${a.maxScore}` : "Not graded"}
                              </span>
                              {a.isLate && (
                                <span className="text-xs text-amber-600 dark:text-amber-400">(late)</span>
                              )}
                              {(!a.isPublished || a.score == null) && (
                                <Link
                                  href={`/assessments/${a.assessmentId}/submissions/${a.submissionId}/grade`}
                                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                  Mark
                                </Link>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">Not submitted</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ── Record/correct the final course grade ─────── */}
              <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Final course grade
                </h3>
                <RecordGradeForm
                    studentId={entry.studentId}
                    courseOfferingId={courseOfferingId}
                    currentScore={entry.numericScore}
                    isPublished={entry.isPublished}
                    version={entry.version}
                    computedScore={computed.computedScore}
                    isComplete={computed.isComplete}
                    gradedCount={computed.gradedCount}
                    totalCount={computed.totalCount}
                    breakdown={computed.breakdown}
                />
              </div>
            </section>
          );
        })}

        {entries.length === 0 && (
          <p className="rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            No enrolled students in this course offering yet.
          </p>
        )}
      </div>
    </main>
  );
}