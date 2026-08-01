import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { listProgrammesForFilter, listAcademicYears } from "@/services/reference-data.service";
import { listStudentsForProgrammeAndYear } from "@/server/queries/transcript-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ programmeId?: string; academicYearId?: string }>;
}

export default async function TranscriptSelectorPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");

  const { programmeId, academicYearId } = await searchParams;
  const [programmes, academicYears] = await Promise.all([
    listProgrammesForFilter(),
    listAcademicYears(),
  ]);

  const students =
    programmeId && academicYearId
      ? await listStudentsForProgrammeAndYear(programmeId, academicYearId)
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Academic Transcript
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Pick a programme and an admission year to see its students, then open a student to
          see their full result history across the whole programme.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Programme
          </label>
          <select
            name="programmeId"
            defaultValue={programmeId ?? ""}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Select programme…</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Admission year
          </label>
          <select
            name="academicYearId"
            defaultValue={academicYearId ?? ""}
            className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Select year…</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Find students
        </button>
      </form>

      {students && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          {students.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">
              No students found for this programme + year.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {students.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/transcript/${s.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {s.name}
                      </span>
                      <span className="ml-2 text-xs text-zinc-400">{s.studentNumber}</span>
                    </span>
                    <span className="text-xs uppercase text-zinc-400">{s.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}