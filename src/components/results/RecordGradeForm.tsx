"use client";

import { useActionState } from "react";
import { recordGradeAction } from "@/app/actions/result-actions";

interface RecordGradeFormProps {
  studentId: string;
  courseOfferingId: string;
  currentScore: number | null;
  isPublished: boolean;
  version: number | null;
}

export function RecordGradeForm({
  studentId,
  courseOfferingId,
  currentScore,
  isPublished,
  version,
}: RecordGradeFormProps) {
  const [state, formAction, isPending] = useActionState(recordGradeAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="courseOfferingId" value={courseOfferingId} />
      {version !== null && <input type="hidden" name="expectedVersion" value={version} />}

      <div className="flex items-end gap-3">
        <div>
          <label
            htmlFor={`score-${studentId}`}
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Score (0–100)
          </label>
          <input
            id={`score-${studentId}`}
            name="numericScore"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={currentScore ?? ""}
            required
            className="mt-1 block w-28 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Saving…" : currentScore === null ? "Save" : "Update"}
        </button>
      </div>

      {isPublished && (
        <div>
          <label
            htmlFor={`reason-${studentId}`}
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Reason for correction (required — this result is published)
          </label>
          <input
            id={`reason-${studentId}`}
            name="reason"
            type="text"
            required
            placeholder="e.g. remark request upheld, transcription error"
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Saving a correction will automatically withhold this result from the student
            until you republish it.
          </p>
        </div>
      )}

      {state && !state.success && (
        <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
          <p>{state.error}</p>
          {state.fieldErrors && Object.entries(state.fieldErrors).map(([field, errors]) => (
            <p key={field} className="text-xs">
              <span className="font-medium">{field}:</span> {errors?.[0]}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}