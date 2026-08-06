"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAssessmentAction } from "@/app/actions/assessment-actions";
import { AssessmentType } from "@/types";
import { DueDateGraceField } from "@/components/assessments/DueDateGraceField";

interface CourseOfferingOption {
  id: string;
  semester: string;
  course: { code: string; title: string };
  academicYear: { name: string };
}

export function CreateAssessmentForm({
  courseOfferings,
  defaultCourseOfferingId,
}: {
  courseOfferings: CourseOfferingOption[];
  defaultCourseOfferingId?: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createAssessmentAction, null);

  useEffect(() => {
    if (state?.success) {
      router.push("/assessments");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="courseOfferingId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Course
        </label>
        <select
          id="courseOfferingId"
          name="courseOfferingId"
          required
          defaultValue={defaultCourseOfferingId ?? ""}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="" disabled>
            Select a course offering…
          </option>
          {courseOfferings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.course.code} — {o.course.title} ({o.semester.replaceAll("_", " ")}
              {o.academicYear.name})
            </option>
          ))}
        </select>
        {state && !state.success && state.fieldErrors?.courseOfferingId && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.courseOfferingId[0]}</p>
        )}
        {courseOfferings.length === 0 && (
          <p className="mt-1 text-sm text-amber-600">
            No course offerings exist yet — create one first.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {state && !state.success && state.fieldErrors?.title && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Type
        </label>
        <select
          id="type"
          name="type"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {Object.values(AssessmentType).map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="weightPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Weight (%)
          </label>
          <input
            id="weightPercentage"
            name="weightPercentage"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Max score
          </label>
          <input
            id="maxScore"
            name="maxScore"
            type="number"
            min={1}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <DueDateGraceField
        dueDateError={state && !state.success ? state.fieldErrors?.dueDate?.[0] : undefined}
      />

      <div>
        <label htmlFor="maxAttempts" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Max attempts
        </label>
        <input
          id="maxAttempts"
          name="maxAttempts"
          type="number"
          min={1}
          max={10}
          defaultValue={5}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Students can replace their submission up to this many times while the deadline
          (+ grace period) hasn&apos;t passed yet. Set to 1 to lock it after the first submission.
        </p>
      </div>

      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && state.success && <p className="text-sm text-emerald-600">Assessment created.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create assessment"}
      </button>
    </form>
  );
}