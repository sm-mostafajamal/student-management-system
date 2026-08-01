"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createCourseAction, updateCourseAction } from "@/actions/course.actions";
import type { ActionResult } from "@/actions/programme.actions";
import { FormError, FieldError } from "@/components/ui/form-error";

// `course` comes from getCourseById(), which returns the SERIALIZED shape
// (courseFee converted from Prisma.Decimal to a plain number) — not the raw
// Prisma `Course` type, which still has courseFee typed as Decimal and
// can't cross the Server Component → Client Component boundary.
interface CourseFormProps {
  course?: Omit<
    import("@prisma/client").Course,
    "courseFee"
  > & { courseFee: number };
  programmes: { id: string; code: string; name: string; creditHourRate: number }[];
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

  // Track programme + credit hours so we can auto-calculate the course fee
  // as creditHours × the selected programme's creditHourRate.
  const [programmeId, setProgrammeId] = useState<string>(
    course?.programmeId ?? defaultProgrammeId ?? ""
  );
  const [creditHours, setCreditHours] = useState<number>(course?.creditHours ?? 3);

  const selectedProgramme = useMemo(
    () => programmes.find((p) => p.id === programmeId),
    [programmes, programmeId]
  );

  const creditHourRate = selectedProgramme ? Number(selectedProgramme.creditHourRate) : 0;

  const calculatedFee = useMemo(() => {
    const hours = Number.isFinite(creditHours) ? creditHours : 0;
    return Math.max(hours, 0) * creditHourRate;
  }, [creditHours, creditHourRate]);

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
          value={programmeId}
          onChange={(e) => setProgrammeId(e.target.value)}
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
            value={creditHours}
            onChange={(e) => setCreditHours(e.target.valueAsNumber || 0)}
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

      {/* Course Fee — auto-calculated from creditHours × the selected programme's creditHourRate */}
      <div>
        <label
          htmlFor="courseFee"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course Fee
          <span className="ml-1 text-xs text-zinc-400">(auto-calculated)</span>
        </label>
        <input
          id="courseFee"
          type="text"
          readOnly
          disabled
          value={calculatedFee.toFixed(2)}
          className="mt-1.5 block w-full cursor-not-allowed rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
        />
        {/* Disabled inputs don't submit — this hidden field carries the actual value */}
        <input type="hidden" name="courseFee" value={calculatedFee} />
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {selectedProgramme ? (
            creditHourRate > 0 ? (
              <>
                {creditHours} credit{creditHours !== 1 ? "s" : ""} × ৳{creditHourRate.toFixed(2)}{" "}
                per credit hour ({selectedProgramme.code}) = ৳{calculatedFee.toFixed(2)}
              </>
            ) : (
              <>
                {selectedProgramme.code} has no credit hour rate configured, so the fee is ৳0.00.
                Set a Credit Hour Rate on the programme to enable billing.
              </>
            )
          ) : (
            "Select a programme above to calculate the fee."
          )}
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