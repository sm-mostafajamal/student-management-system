import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OfferingForm } from "@/components/course-offerings/offering-form";
import { listAcademicYears } from "@/services/reference-data.service";
import { listCourses } from "@/services/course.service";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  searchParams: Promise<{ courseId?: string }>;
}

export const metadata = { title: "New Course Offering — Registry" };

export default async function NewOfferingPage({ searchParams }: PageProps) {
  await requireStaff();
  const { courseId } = await searchParams;

  const [{ items: courses }, academicYears, instructors] = await Promise.all([
    listCourses({ includeInactive: false, pageSize: 200 }),
    listAcademicYears(),
    // Only surface STAFF/ADMIN users as selectable instructors — defensive UI
    // (the service validates again server-side, but we don't pollute the dropdown)
    prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/course-offerings"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to offerings
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          New Course Offering
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Schedule a course for a specific academic year and semester. Each course can only be
          offered once per semester per year.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <OfferingForm
          courses={courses}
          academicYears={academicYears}
          instructors={instructors}
          defaultCourseId={courseId}
        />
      </div>
    </div>
  );
}