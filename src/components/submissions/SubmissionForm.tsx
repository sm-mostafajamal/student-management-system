"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { submitAssessmentAction } from "@/app/actions/submission-actions";

export function SubmissionForm({
  assessmentId,
  hasExisting,
}: {
  assessmentId: string;
  hasExisting: boolean;
}) {
  const [state, formAction, isPending] = useActionState(submitAssessmentAction, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(
        `Submitted (attempt ${state.data.attemptNumber}). ${state.data.isLate ? "Flagged as late." : "On time."}`
      );
    } else if (state.error && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div>
        <label
          htmlFor="file"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {hasExisting ? "Replace file (PDF or DOCX)" : "Upload file (PDF or DOCX)"}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-gray-300 dark:file:bg-indigo-900/40 dark:file:text-indigo-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Max size 10MB. Only PDF and DOCX files are accepted.
        </p>
        {state && !state.success && state.fieldErrors?.file && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.file[0]}</p>
        )}
      </div>

      {state && !state.success && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && state.success && (
        <p className="text-sm text-emerald-600">
          Submitted (attempt {state.data.attemptNumber}).
          {state.data.isLate ? "Flagged as late." : "On time."}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Uploading…" : hasExisting ? "Resubmit" : "Submit"}
      </button>
    </form>
  );
}