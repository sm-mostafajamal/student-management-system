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

const initialState: ActionResult | null = null;

export function CourseForm({ course, programmes, defaultProgrammeId }: CourseFormProps) {
  const isEdit = Boolean(course);
  const action = isEdit ? updateCourseAction : createCourseAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      const id = (state as { success: true; data: { id: string } }).data?.id ?? course?.id;
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

        {/* Credits */}
        <div>
          <label
            htmlFor="credits"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Credits
            <span className="ml-1 text-red-500">*</span>
          </label>
          <input
            id="credits"
            name="credits"
            type="number"
            required
            min={1}
            max={12}
            defaultValue={course?.credits ?? 3}
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <FieldError message={fieldError("credits")} />
        </div>
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course Name
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={course?.name}
          placeholder="e.g. Introduction to Programming"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <FieldError message={fieldError("name")} />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description
          <span className="ml-1 text-xs text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={course?.description ?? ""}
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
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
}ww