"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitAssessmentAction } from "@/app/actions/submission-actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {pending ? "Uploading..." : label}
    </button>
  );
}

export function SubmissionForm({
  assessmentId,
  isResubmission,
  isPastDeadline,
}: {
  assessmentId: string;
  isResubmission: boolean;
  isPastDeadline: boolean;
}) {
  const [state, formAction] = useActionState(submitAssessmentAction, null);

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-4">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div>
        <label htmlFor="file" className="block text-sm font-medium">
          {isResubmission ? "Replace your submission" : "Upload your submission"}
        </label>
        <input id="file" name="file" type="file" required className="mt-1 w-full text-sm" />
        {state && !state.success && state.fieldErrors?.file && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.file[0]}</p>
        )}
      </div>

      {isPastDeadline && (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          The due date (plus grace period) has passed — this submission will be marked late.
        </p>
      )}

      {state && !state.success && !state.fieldErrors && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state && state.success && (
        <p role="status" className="rounded-md bg-green-50 p-2 text-sm text-green-800">
          Submitted successfully{state.data.isLate ? " (marked late)" : ""}. Attempt
          {state.data.attemptNumber}.
        </p>
      )}

      <SubmitButton label={isResubmission ? "Resubmit" : "Submit"} />
    </form>
  );
}