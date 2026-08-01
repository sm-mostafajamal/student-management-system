import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { ResultClassification, Role } from "@/types";
import { getStudentTranscript } from "@/server/queries/transcript-queries";
import { ClassificationBadge } from "@/components/results/ClassificationBadge";

export const dynamic = "force-dynamic";

export default async function StudentTranscriptPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");

  const { studentId } = await params;
  const data = await getStudentTranscript(studentId);
  if (!data) notFound();

  const { student, terms, overallAverage, overallClassification } = data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/transcript"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transcript search
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {student.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {student.studentNumber} · {student.programmeCode} — {student.programmeName} ·
            Admitted {student.admissionYearName}
          </p>
        </div>
        {overallClassification && overallAverage !== null && (
          <div className="rounded-lg border border-zinc-200 px-4 py-2 text-right dark:border-zinc-800">
            <p className="text-xs text-zinc-400">Overall average (published only)</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {overallAverage.toFixed(1)}
            </p>
            <ClassificationBadge classification={overallClassification} />
          </div>
        )}
      </div>

      <div className="mt-8 space-y-6">
        {terms.length === 0 && (
          <p className="rounded-md bg-zinc-50 p-6 text-center text-sm text-zinc-400 dark:bg-zinc-900">
            No enrollments recorded yet for this student.
          </p>
        )}
        {terms.map((term) => (
          <section
            key={`${term.academicYearName}-${term.semester}`}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800"
          >
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {term.academicYearName} · {term.semester.replace(/_/g, " ")}
              </h2>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {term.courses.map((c) => (
                <li
                  key={c.courseCode}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {c.courseCode}
                    </span>
                    <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                      {c.courseTitle}
                    </span>
                    <span className="ml-2 text-xs text-zinc-400">{c.creditHours} cr</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.isPublished && c.classification ? (
                      <>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {c.numericScore}
                        </span>
                        <ClassificationBadge classification={c.classification as ResultClassification} />
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {c.numericScore !== null ? "Withheld" : "Not graded yet"}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}