import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOfferingById } from "@/services/course.service";
import { listAcademicYears, listProgrammesForFilter } from "@/services/reference-data.service";
import { OfferingForm } from "@/components/course-offerings/offering-form";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SEMESTER_LABELS: Record<string, string> = {
  FALL: "Fall",
  SPRING: "Spring",
  SUMMER: "Summer",
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const o = await getOfferingById(id);
  if (!o) return { title: "Offering not found" };
  return {
    title: `${o.course.code} ${o.academicYear.name} ${SEMESTER_LABELS[o.semester]} — Offerings`,
  };
}

export default async function OfferingDetailPage({ params }: PageProps) {
  await requireStaff();
  const { id } = await params;

  const [offering, academicYears, instructors] = await Promise.all([
    getOfferingById(id),
    listAcademicYears(),
    prisma.user.findMany({
      where: { role: { in: ["STAFF"] } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!offering) notFound();

  const enrollmentPct =
    offering?.capacity != null && offering?.capacity > 0
      ? Math.round((offering._count.enrollments / offering?.capacity) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/course-offerings"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to offerings
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {offering.course.title}
              </h1>
              <StatusBadge active={offering.course.isActive} />
            </div>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              <Link
                href={`/courses/${offering.course.id}`}
                className="font-mono text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {offering.course.code}
              </Link>
              {" · "}
              {offering.academicYear.name}
              {" · "}
              {SEMESTER_LABELS[offering.semester] ?? offering.semester}
              {" · "}
              <Link
                href={`/programmes/${offering.course.programme?.id}`}
                className="text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {offering?.course?.programme?.code}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Capacity summary card */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Enrolled", value: offering._count.enrollments },
          { label: "Capacity", value: offering.capacity },
          { label: "Fill rate", value: `${enrollmentPct}%` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Offering details
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <OfferingForm
            offering={offering}
            courses={[offering.course]}
            academicYears={academicYears}
            instructors={instructors}
          />
        </div>
      </section>
    </div>
  );
}