"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { enrollStudentAction } from "@/app/actions/enrollment-actions";

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
    >
      {pending ? "Enrolling..." : "Enrol student"}
    </button>
  );
}

export function EnrollStudentForm({
  courseOfferingId,
  atCapacity,
}: {
  courseOfferingId: string;
  atCapacity: boolean;
}) {
  const [state, formAction] = useActionState(enrollStudentAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseOfferingId" value={courseOfferingId} />

      <div>
        <label htmlFor="studentId" className="block text-sm font-medium">
          Student ID
        </label>
        <input
          id="studentId"
          name="studentId"
          required
          placeholder="e.g. STU-2024-00123"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        {state && !state.success && state.fieldErrors?.studentId && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.studentId[0]}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Look the student up in the Student Directory if you don't have their ID handy.
        </p>
      </div>

      {atCapacity && (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          This offering shows as full as of page load. You can still try — the server will reject
          it if there really is no capacity left.
        </p>
      )}

      {state && !state.success && !state.fieldErrors && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state && state.success && (
        <p role="status" className="rounded-md bg-green-50 p-2 text-sm text-green-800">
          Student enrolled successfully.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}