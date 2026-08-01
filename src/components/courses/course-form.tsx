"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Course, Programme } from "@prisma/client";
import { createCourseAction, updateCourseAction } from "@/actions/course.actions";
import type { ActionResult } from "@/actions/programme.actions";
import { FormError, FieldError } from "@/components/ui/form-error";

interface CourseFormProps {
  course?: Course;
  programmes: Pick<Programme, "id" | "code" | "name">[];
  /** Pre-select a programme (e.g. when navigating from /programmes/[id]/courses/new) */
  defaultProgrammeId?: string;
}

type CourseResult = ActionResult<{ id: string }>;

const initialState: CourseResult | null = null;

export function CourseForm({ course, programmes, defaultProgrammeId }: CourseFormProps) {
  const isEdit = Boolean(course);

  const action: (
    state: CourseResult | null,
    formData: FormData
  ) => Promise<CourseResult> = isEdit ? updateCourseAction : createCourseAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      const id = state.data?.id ?? course?.id;
      router.push(id ? `/courses/${id}` : "/courses");
    }
  }, [state, course?.id, router]);

  const fieldError = (field: string) =>
    state && !state.success && state.field === field ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {isEdit && (
        <>
          <input type="hidden" name="id" value={course!.id} />
          <input type="hidden" name="isActive" value={String(course!.isActive)} />
        </>
      )}

      {state && !state.success && !state.field && (
        <FormError message={state.error} />
      )}

      {/* Programme */}
      <div>
        <label
          htmlFor="programmeId"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Programme
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="programmeId"
          name="programmeId"
          required
          defaultValue={course?.programmeId ?? defaultProgrammeId ?? ""}
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Select a programme…</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldError("programmeId")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Code */}
        <div>
          <label
            htmlFor="code"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Course Code
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            defaultValue={course?.code}
            placeholder="e.g. CS-101"
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <FieldError message={fieldError("code")} />
        </div>

        {/* Credit Hours */}
        <div>
          <label
            htmlFor="creditHours"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Credit Hours
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="creditHours"
            name="creditHours"
            type="number"
            required
            min={1}
            max={12}
            defaultValue={course?.creditHours ?? 3}
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <FieldError message={fieldError("creditHours")} />
        </div>
      </div>

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course Title
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={course?.title}
          placeholder="e.g. Introduction to Programming"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <FieldError message={fieldError("title")} />
      </div>

      {/* Course Fee */}
      <div>
        <label
          htmlFor="courseFee"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course Fee
          <span className="ml-1 text-xs text-zinc-400">(billed once per enrolment)</span>
        </label>
        <input
          id="courseFee"
          name="courseFee"
          type="number"
          min={0}
          step="0.01"
          defaultValue={course?.courseFee !== undefined ? Number(course.courseFee) : 0}
          placeholder="0.00"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Leave 0 for courses with no extra charge (e.g. general-education courses).
          Changing this does not retroactively reprice existing enrolments.
        </p>
        <FieldError message={fieldError("courseFee")} />
      </div>

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
          {isPending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create course"}
        </button>
      </div>
    </form>
  );
}
