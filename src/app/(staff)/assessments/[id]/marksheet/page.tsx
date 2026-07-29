import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMarksheetForCourseOffering } from "@/services/result.service";
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

  const entries = await getMarksheetForCourseOffering(courseOfferingId, user);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Marksheet</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {entries.length} enrolled student(s). Only published results are visible to students.
      </p>

      <div className="mt-6 space-y-4">
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
    </main>
  );
}