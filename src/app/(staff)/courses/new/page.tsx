import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CourseForm } from "@/components/courses/course-form";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  searchParams: Promise<{ programmeId?: string }>;
}

export const metadata = { title: "New Course — Registry" };

export default async function NewCoursePage({ searchParams }: PageProps) {
  await requireStaff();
  const { programmeId } = await searchParams;

  const programmes = await listProgrammesForFilter();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/courses"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to courses
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          New Course
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Courses belong to a single programme and can be offered across multiple semesters.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <CourseForm programmes={programmes} defaultProgrammeId={programmeId} />
      </div>
    </div>
  );
}