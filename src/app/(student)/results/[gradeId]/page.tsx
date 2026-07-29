import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getStudentPublishedResult } from "@/services/result.service";
import { ClassificationBadge } from "@/components/results/ClassificationBadge";
import { DomainError } from "@/lib/errors";
import { Role } from "@/types";

// Direct-access defense: a student guessing/bookmarking a gradeId that
// belongs to someone else, or one that's withheld, gets a plain 404 here
// — getStudentPublishedResult() throws the identical NOT_FOUND for both
// "not yours" and "not published yet" (see result.service.ts).
export default async function StudentResultDetailPage({
  params,
}: {
  params: Promise<{ gradeId: string }>;
}) {
  const { gradeId } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) {
    redirect("/");
  }

  try {
    const result = await getStudentPublishedResult(gradeId, user.studentId);
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {result.courseCode} — {result.courseTitle}
        </h1>
        <div className="mt-6 rounded-lg border border-gray-200 p-6 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">Final score</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {result.numericScore.toFixed(2)}
            <span className="ml-1 text-base font-normal text-gray-400">/ 100</span>
          </p>
          <div className="mt-3">
            <ClassificationBadge classification={result.classification} />
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Published {result.publishedAt?.toLocaleString() ?? "—"}
          </p>
        </div>
      </main>
    );
  } catch (err) {
    if (err instanceof DomainError && err.code === "NOT_FOUND") {
      notFound();
    }
    throw err;
  }
}