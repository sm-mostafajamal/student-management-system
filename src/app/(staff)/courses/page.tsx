import Link from "next/link";
import { Plus, GraduationCap } from "lucide-react";
import { listCourses } from "@/services/course.service";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    programmeId?: string;
    showInactive?: string;
  }>;
}

export const metadata = { title: "Courses — Registry" };

export default async function CoursesPage({ searchParams }: PageProps) {
  await requireStaff();
  const { page: pageParam, search, programmeId, showInactive } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ items, total, totalPages, pageSize }, programmes] = await Promise.all([
    listCourses({
      page,
      search: search || undefined,
      programmeId: programmeId || undefined,
      includeInactive: showInactive === "true",
    }),
    listProgrammesForFilter(), // read from existing reference-data.service.ts
  ]);

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (search) params.set("search", search);
    if (programmeId) params.set("programmeId", programmeId);
    if (showInactive) params.set("showInactive", showInactive);
    return `/courses?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Courses</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} course{total !== 1 ? "s" : ""} across all programmes
          </p>
        </div>
        <Link
          href="/courses/new"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New course
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-3">
        <input
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search code or name…"
          className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <select
          name="programmeId"
          defaultValue={programmeId ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            name="showInactive"
            type="checkbox"
            defaultChecked={showInactive === "true"}
            value="true"
            className="rounded border-zinc-300 text-indigo-600"
          />
          Show inactive
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <GraduationCap className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No courses found</p>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              {search ? "Try a different search." : "Create your first course to get started."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {["Code", "Name", "Programme", "Credits", "Offerings", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {items.map((course) => (
                <tr key={course.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {course.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {course.name}
                  </td>
                  <td className="px-4 py-3">
                  {course.programme ? (
                    <Link
                      href={`/programmes/${course.programme.id}`}
                      className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {course.programme.code}
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">General / Cross-programme</span>
                  )}
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

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        buildHref={buildHref}
      />
    </div>
  );
}