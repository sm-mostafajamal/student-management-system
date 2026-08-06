import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { getCourseById } from "@/services/course.service";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { CourseForm } from "@/components/courses/course-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SEMESTER_LABELS: Record<string, string> = {
  FIRST_SEMESTER: "Fall",
  SECOND_SEMESTER: "Spring",
  SUMMER_SEMESTER: "Summer",
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const course = await getCourseById(id);
  return { title: course ? `${course.code} — Courses` : "Course not found" };
}

export default async function CourseDetailPage({ params }: PageProps) {
  await requireStaff();
  const { id } = await params;

  const [course, programmes] = await Promise.all([
    getCourseById(id),
    listProgrammesForFilter(),
  ]);

  if (!course) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/courses"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to courses
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {course.title}
              </h1>
              <StatusBadge active={course.isActive} />
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-mono">{course.code}</span>
              <span>·</span>
              <Link
                href={`/programmes/${course?.programme?.id}`}
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {course?.programme?.code} — {course?.programme?.name}
              </Link>
              <span>·</span>
              <span>{course.creditHours} credit{course.creditHours !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Course details
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <CourseForm course={course} programmes={programmes} />
        </div>
      </section>

      {/* Offerings */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Offerings ({course.offerings.length})
          </h2>
          <Link
            href={`/course-offerings/new?courseId=${course.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
            New offering
          </Link>
        </div>

        {course.offerings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            No offerings scheduled yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  {["Year", "Semester", "Instructor", "Enrolled / Cap", "Status", ""].map((h) => (
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
                {course.offerings.map((o) => {
                  const capacity = o.capacity ?? 0;
                  const pct = capacity > 0 ? (o._count.enrollments / capacity) * 100 : 0;
                  const isFull = pct >= 100;
                  return (
                    <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {o.academicYear.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {SEMESTER_LABELS[o.semester] ?? o.semester}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {o.instructor?.firstName} {o.instructor?.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm tabular-nums ${
                            isFull
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : "text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {o._count.enrollments} / {o.capacity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={o.isActive} />
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
      </section>
    </div>
  );
}