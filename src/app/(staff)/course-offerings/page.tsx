import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { listOfferings } from "@/services/course.service";
import { listAcademicYears, listProgrammesForFilter } from "@/services/reference-data.service";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    courseId?: string;
    academicYearId?: string;
  }>;
}

export const metadata = { title: "Course Offerings — Registry" };

const SEMESTER_LABELS: Record<string, string> = {
  FIRST_SEMESTER: "Fall",
  SECOND_SEMESTER: "Spring",
  SUMMER_SEMESTER: "Summer",
};

export default async function CourseOfferingsPage({ searchParams }: PageProps) {
  await requireStaff();
  const { page: pageParam, courseId, academicYearId } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ items, total, totalPages, pageSize }, academicYears] = await Promise.all([
    listOfferings({
      page,
      courseId: courseId || undefined,
      academicYearId: academicYearId || undefined,
    }),
    listAcademicYears(),
  ]);

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (academicYearId) params.set("academicYearId", academicYearId);
    return `/course-offerings?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Course Offerings
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} offering{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/course-offerings/new"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New offering
        </Link>
      </div>

      {/* Filter by year */}
      <form method="GET" className="flex items-center gap-3">
        <select
          name="academicYearId"
          defaultValue={academicYearId ?? ""}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All academic years</option>
          {academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
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
          <CalendarDays className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No offerings found</p>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              Schedule a course for an academic year and semester.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                {["Course", "Programme", "Year", "Semester", "Instructor", "Enrolled / Cap", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {items.map((o) => {
                const pct = o.capacity > 0 ? (o._count.enrollments / o.capacity) * 100 : 0;
                const isFull = pct >= 100;
                const isNearFull = pct >= 80 && !isFull;
                return (
                  <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/courses/${o.course.id}`}
                        className="font-mono text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {o.course.code}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                        {o.course.title}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {o.course.programme?.code ?? 'General / Cross-programme'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {o.academicYear.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {SEMESTER_LABELS[o.semester] ?? o.semester}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {o.instructor.firstName} {o.instructor.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm tabular-nums font-medium ${
                          isFull
                            ? "text-red-600 dark:text-red-400"
                            : isNearFull
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {o._count.enrollments} / {o.capacity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={o.course.isActive} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/course-offerings/${o.id}`}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
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