"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
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

  // Course Fee is editable — the credit-hour calculation is a starting
  // suggestion, not the only way to price a course. When creditHourRate
  // is 0 (the normal "use a flat fee" case, per the schema comment on
  // Programme.creditHourRate), there'd otherwise be no way to set a price
  // at all. Once staff type their own value, stop overwriting it if
  // programme/creditHours change afterward.
  const [courseFeeInput, setCourseFeeInput] = useState<string>(
    course ? course.courseFee.toFixed(2) : calculatedFee.toFixed(2)
  );
  const [feeManuallyEdited, setFeeManuallyEdited] = useState<boolean>(isEdit);

  useEffect(() => {
    if (!feeManuallyEdited) {
      setCourseFeeInput(calculatedFee.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedFee]);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      const id = state.data?.id ?? course?.id;
      toast.success(isEdit ? "Course updated." : "Course created.");
      router.push(id ? `/courses/${id}` : "/courses");
    } else if (!state.field) {
      toast.error(state.error ?? "Something went wrong. Please try again.");
    }
  }, [state, course?.id, router, isEdit]);

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
            onChange={(e) => {
              setCreditHours(e.target.valueAsNumber ?? '');
              // Typing a new credit hour value should trigger auto-calculation,
              // clearing any previous manual override on the fee field.
              setFeeManuallyEdited(false);
            }}
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

      {/* Course Fee — editable. Pre-filled from creditHours × the selected
          programme's creditHourRate as a starting suggestion, but staff can
          type their own flat fee (this is the normal path when the
          programme has no creditHourRate configured — see schema comment
          on Programme.creditHourRate). */}
      <div>
        <label
          htmlFor="courseFee"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Course Fee
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="courseFee"
            name="courseFee"
            type="number"
            step="0.01"
            min="0"
            required
            value={courseFeeInput}
            onChange={(e) => {
              setFeeManuallyEdited(true);
              setCourseFeeInput(e.target.value);
            }}
            className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {creditHourRate > 0 && (
            <button
              type="button"
              onClick={() => {
                setFeeManuallyEdited(false);
                setCourseFeeInput(calculatedFee.toFixed(2));
              }}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Use calculated
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {selectedProgramme ? (
            creditHourRate > 0 ? (
              <>
                Suggested: {creditHours} credit{creditHours !== 1 ? "s" : ""} × ৳{creditHourRate.toFixed(2)}{" "}
                per credit hour ({selectedProgramme.code}) = ৳{calculatedFee.toFixed(2)}. You can
                override this with a flat fee.
              </>
            ) : (
              <>
                {selectedProgramme.code} has no credit hour rate configured — enter a flat fee, or
                set a Credit Hour Rate on the programme to auto-calculate one.
              </>
            )
          ) : (
            "Select a programme above, or enter a flat fee directly."
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