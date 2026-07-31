"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Programme } from "@prisma/client";
import { ProgrammeLevel } from "@/types";
import {
  createProgrammeAction,
  updateProgrammeAction,
} from "@/actions/programme.actions";
import type { ActionResult } from "@/actions/programme.actions";
import { FormError, FieldError } from "@/components/ui/form-error";

interface ProgrammeFormProps {
  programme?: Programme;
  onSuccess?: (id: string) => void;
}

type ProgrammeResult = ActionResult<{ id: string }>;

const initialState: ProgrammeResult | null = null;

export function ProgrammeForm({ programme, onSuccess }: ProgrammeFormProps) {
  const isEdit = Boolean(programme);

  const action: (
    state: ProgrammeResult | null,
    formData: FormData
  ) => Promise<ProgrammeResult> = isEdit ? updateProgrammeAction : createProgrammeAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      const id = state.data?.id ?? programme?.id;
      if (onSuccess && id) {
        onSuccess(id);
      } else {
        router.push("/programmes");
      }
    }
  }, [state, onSuccess, programme?.id, router]);

  const fieldError = (field: string) =>
    state && !state.success && state.field === field ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden fields for update */}
      {isEdit && (
        <>
          <input type="hidden" name="id" value={programme!.id} />
          <input
            type="hidden"
            name="isActive"
            value={String(programme!.isActive)}
          />
        </>
      )}

      {/* Form-level error (no field match) */}
      {state && !state.success && !state.field && (
        <FormError message={state.error} />
      )}

      <div>
        <label
          htmlFor="code"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Programme Code
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="code"
          name="code"
          type="text"
          required
          defaultValue={programme?.code}
          placeholder="e.g. CS-BSC"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          aria-describedby={fieldError("code") ? "code-error" : undefined}
        />
        <FieldError message={fieldError("code")} />
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Programme Name
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={programme?.name}
          placeholder="e.g. Bachelor of Science in Computer Science"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <FieldError message={fieldError("name")} />
      </div>

      <div>
        <label
          htmlFor="level"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Level
          <span className="ml-1 text-red-500">*</span>
        </label>
        <select
          id="level"
          name="level"
          required
          defaultValue={programme?.level ?? ""}
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="" disabled>
            Select a level…
          </option>
          {Object.values(ProgrammeLevel).map((level) => (
            <option key={level} value={level}>
              {level.charAt(0) + level.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <FieldError message={fieldError("level")} />
      </div>

      <div>
        <label
          htmlFor="durationYears"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Duration (years)
          <span className="ml-1 text-red-500">*</span>
        </label>
        <input
          id="durationYears"
          name="durationYears"
          type="number"
          min={1}
          max={10}
          required
          defaultValue={programme?.durationYears}
          placeholder="e.g. 4"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <FieldError message={fieldError("durationYears")} />
      </div>

      <div>
        <label
          htmlFor="departmentName"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Department
          <span className="ml-1 text-xs text-zinc-400">(optional)</span>
        </label>
        <input
          id="departmentName"
          name="departmentName"
          type="text"
          defaultValue={programme?.departmentName ?? ""}
          placeholder="e.g. School of Computing"
          className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <FieldError message={fieldError("departmentName")} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
            ? "Save changes"
            : "Create programme"}
        </button>
      </div>
    </form>
  );
}