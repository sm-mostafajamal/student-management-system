import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { listProgrammes } from "@/services/programme.service";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth-helpers";
import { DeactivateProgrammeButton } from "@/components/programmes/deactivate-programme-button";

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; showInactive?: string }>;
}

export const metadata = { title: "Programmes — Registry" };

export default async function ProgrammesPage({ searchParams }: PageProps) {
  await requireStaff();

  const { page: pageParam, search, showInactive } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { items, total, totalPages, pageSize } = await listProgrammes({
    page,
    search: search || undefined,
    includeInactive: showInactive === "true",
  });

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (search) params.set("search", search);
    if (showInactive) params.set("showInactive", showInactive);
    return `/programmes?${params}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Programmes
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} programme{total !== 1 ? "s" : ""} in the registry
          </p>
        </div>
        <Link
          href="/programmes/new"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          New programme
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="flex items-center gap-3">
        <input
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search code or name…"
          className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
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
          <BookOpen className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No programmes found</p>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              {search ? "Try a different search term." : "Create your first programme to get started."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {["Code", "Name", "Courses", "Active students", "Status", ""].map((h) => (
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
              {items.map((prog) => (
                <tr key={prog.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {prog.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {prog.name}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                    {prog._count.courses}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                    {prog._count.students}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={prog.isActive} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <DeactivateProgrammeButton
                        programme={{
                          id: prog.id,
                          code: prog.code,
                          name: prog.name,
                          isActive: prog.isActive,
                        }}
                      />
                      <Link
                        href={`/programmes/${prog.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        View
                      </Link>
                    </div>
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