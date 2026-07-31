"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AssessmentStatusFilter } from "@/server/queries/assessment-queries";
import { Route } from "next";

interface CourseOption {
  id: string;
  code: string;
  title: string;
}
interface ProgrammeOption {
  id: string;
  code: string;
  name: string;
}

export function AssessmentFilters({
  courses,
  programmes,
  selected,
}: {
  courses: CourseOption[];
  programmes: ProgrammeOption[];
  selected: {
    courseId?: string;
    programmeId?: string;
    status: AssessmentStatusFilter;
  };
}) {
const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();

function update(key: string, value: string) {
  const params = new URLSearchParams(searchParams.toString());

  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }

  const url = `${pathname}?${params.toString()}` as Route;
  router.push(url);
}

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={selected.courseId ?? ""}
        onChange={(e) => update("courseId", e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All courses</option>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.title}
          </option>
        ))}
      </select>

      <select
        value={selected.programmeId ?? ""}
        onChange={(e) => update("programmeId", e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All programmes</option>
        {programmes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>

      <select
        value={selected.status}
        onChange={(e) => update("status", e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
        <option value="late_pending">Late submissions pending</option>
      </select>
    </div>
  );
}