"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { CourseOffering, Course, AcademicYear, User } from "@prisma/client";
import { createOfferingAction, updateOfferingAction } from "@/actions/course.actions";
import type { ActionResult } from "@/actions/programme.actions";
import { FormError, FieldError } from "@/components/ui/form-error";

const SEMESTER_LABELS: Record<string, string> = {
  FALL: "Fall",
  SPRING: "Spring",
  SUMMER: "Summer",
};

interface OfferingFormProps {
  offering?: CourseOffering;
  courses: Pick<Course, "id" | "code" | "name">[];
  academicYears: Pick<AcademicYear, "id" | "label">[];
  instructors: Pick<User, "id" | "name" | "email">[];
  defaultCourseId?: string;
}

const initialState: ActionResult | null = null;

export function OfferingForm({
  offering,
  courses,
  academicYears,
  instructors,
  defaultCourseId,
}: OfferingFormProps) {
  const isEdit = Boolean(offering);
  const action = isEdit ? updateOfferingAction : createOfferingAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      const id = (state as { success: true; data: { id: string } }).data?.id ?? offering?.id;
      router.push(id ? `/course-offerings/${id}` : "/course-offerings");
    }
  }, [state, offering?.id, router]);

  const fieldError = (field: string) =>
    state && !state.success && state.field === field ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={offering!.id} />}

      {state && !state.success && !state.field && (
        <FormError message={state.error} />
      )}

      {/* Course — locked on edit because it's part of the unique key */}
      <div>
        <label
          htmlFor="courseId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course
          <span className="ml-1 text-red-500">*</span>
        </label>
        {isEdit ? (
          <>
            <input type="hidden" name="courseId" value={offering!.courseId} />
            <p className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              Course cannot be changed after creation.
            </p>
          </>
        ) : (
          <select
            id="courseId"
            name="courseId"
            required
            defaultValue={defaultCourseId ?? ""}
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        )}
        <FieldError message={fieldError("courseId")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Academic Year — locked on edit */}
        <div>
          <label
            htmlFor="academicYearId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Academic Year
            <span className="ml-1 text-red-500">*</span>
          </label>
          {isEdit ? (
            <input type="hidden" name="academicYearId" value={offering!.academicYearId} />
          ) : (
            <select
              id="academicYearId"
              name="academicYearId"
              required
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Select year…</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Semester — locked on edit */}
        <div>
          <label
            htmlFor="semester"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Semester
            <span className="ml-1 text-red-500">*</span>
          </label>
          {isEdit ? (
            <>
              <input type="hidden" name="semester" value={offering!.semester} />
              <p className="mt-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {SEMESTER_LABELS[offering!.semester]} (locked)
              </p>
            </>
          ) : (
            <select
              id="semester"
              name="semester"
              required
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Select semester…</option>
              {Object.entries(SEMESTER_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Instructor */}
      <div>
        <label
          htmlFor="instructorId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Instructor
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="instructorId"
          name="instructorId"
          required
          defaultValue={offering?.instructorId ?? ""}
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select instructor…</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.email})
            </option>
          ))}
        </select>
        <FieldError message={fieldError("instructorId")} />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Only staff and admin users are shown.
        </p>
      </div>

      {/* Capacity */}
      <div>
        <label
          htmlFor="capacity"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Capacity
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="capacity"
          name="capacity"
          type="number"
          required
          min={1}
          max={500}
          defaultValue={offering?.capacity ?? 30}
          className="mt-1.5 block w-32 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <FieldError message={fieldError("capacity")} />
        {isEdit && offering && offering.enrolled > 0 && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {offering.enrolled} student(s) currently enrolled — capacity cannot go below this.
          </p>
        )}
      </div>

      {/* isActive toggle — edit only */}
      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={offering!.isActive}
            onChange={(e) => {
              e.target.form!.elements.namedItem("isActiveHidden")!;
            }}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="isActive" className="text-sm text-zinc-700 dark:text-zinc-300">
            Offering is active (students can enroll)
          </label>
          {/* Checkboxes don't submit when unchecked — use a separate hidden pattern */}
          <input type="hidden" name="isActive" value="false" />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending
            ? isEdit ? "Saving…" : "Creating…"
            : isEdit ? "Save changes" : "Create offering"}
        </button>
      </div>
    </form>
  );
}