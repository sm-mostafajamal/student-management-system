import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getProgrammeById } from "@/services/programme.service";
import { ProgrammeForm } from "@/components/programmes/programme-form";
import { DeactivateProgrammeButton } from "@/components/programmes/deactivate-programme-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const prog = await getProgrammeById(id);
  return { title: prog ? `${prog.code} — Programmes` : "Programme not found" };
}

export default async function ProgrammeDetailPage({ params }: PageProps) {
  await requireStaff();
  const { id } = await params;
  const programme = await getProgrammeById(id);

  if (!programme) notFound();

  const activeStudents = programme._count.students;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Back */}
      <div>
        <Link
          href="/programmes"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to programmes
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {programme.name}
              </h1>
              <StatusBadge active={programme.isActive} />
            </div>
            <p className="mt-0.5 font-mono text-sm text-zinc-500 dark:text-zinc-400">
              {programme.code}
            </p>
          </div>
          <DeactivateProgrammeButton
            programme={{
              id: programme.id,
              code: programme.code,
              name: programme.name,
              isActive: programme.isActive,
            }}
          />
        </div>

        {activeStudents > 0 && !programme.isActive && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
            Note: This programme is inactive but has {activeStudents} active enrollment(s).
          </div>
        )}
      </div>

      {/* Edit form */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Programme details
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ProgrammeForm programme={programme} />
        </div>
      </section>

      {/* Courses within this programme */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Courses ({programme.courses.length})
          </h2>
          <Link
            href={`/courses/new?programmeId=${programme.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Add course
          </Link>
        </div>

        {programme.courses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            No courses yet. Add the first one above.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {["Code", "Name", "Credits", "Offerings", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {programme.courses.map((course) => (
                  <tr key={course.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {course.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {course.name}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                      {course.credits}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                      {course._count.offerings}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={course.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/courses/${course.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}