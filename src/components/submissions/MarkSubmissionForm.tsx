"use client";

import { useActionState } from "react";
import { gradeSubmissionAction } from "@/app/actions/submission-actions";

interface MarkSubmissionFormProps {
  submissionId: string;
  assessmentId: string;
  maxScore: number;
  currentScore: number | null;
  currentFeedback: string | null;
}

export function MarkSubmissionForm({
  submissionId,
  assessmentId,
  maxScore,
  currentScore,
  currentFeedback,
}: MarkSubmissionFormProps) {
  const [state, formAction, isPending] = useActionState(gradeSubmissionAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div>
        <label
          htmlFor="score"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Score (0–{maxScore})
        </label>
        <input
          id="score"
          name="score"
          type="number"
          min={0}
          max={maxScore}
          step="0.01"
          defaultValue={currentScore ?? ""}
          required
          className="mt-1 block w-40 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label
          htmlFor="feedback"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Feedback (optional)
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={4}
          defaultValue={currentFeedback ?? ""}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          placeholder="Optional comments for the student"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Saving…" : currentScore === null ? "Save mark" : "Update mark"}
      </button>

      {state && !state.success && (
        <div className="space-y-1 text-sm text-red-600 dark:text-red-400">
          <p>{state.error}</p>
          {state.fieldErrors &&
            Object.entries(state.fieldErrors).map(([field, errors]) => (
              <p key={field} className="text-xs">
                <span className="font-medium">{field}:</span> {errors?.[0]}
              </p>
            ))}
        </div>
      )}
      {state && state.success && (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Mark saved.
        </p>
      )}
    </form>
  );
}