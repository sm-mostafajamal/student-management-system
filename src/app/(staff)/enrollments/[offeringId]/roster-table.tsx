"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { dropEnrollmentAction } from "@/app/actions/enrollment-actions";

interface RosterEnrollment {
  id: string;
  status: string; // EnrollmentStatus, e.g. "ACTIVE"
  student: {
    id: string;
    fullName: string;
    email: string;
    status: string; // StudentStatus, e.g. "ACTIVE" | "WITHDRAWN" | "SUSPENDED"
  };
}

function DropButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-destructive px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {pending ? "Dropping..." : "Drop"}
    </button>
  );
}

function DropRow({
  enrollment,
  courseOfferingId,
}: {
  enrollment: RosterEnrollment;
  courseOfferingId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useActionState(dropEnrollmentAction, null);

  return (
    <>
      <tr className="border-t">
        <td className="p-3">
          <div className="font-medium">{enrollment.student.fullName}</div>
          <div className="text-xs text-muted-foreground">{enrollment.student.email}</div>
        </td>
        <td className="p-3 text-sm">{enrollment.status}</td>
        <td className="p-3 text-right">
          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-accent"
            >
              Drop...
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/30">
          <td colSpan={3} className="p-3">
            <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <input type="hidden" name="courseOfferingId" value={courseOfferingId} />
              <div className="flex-1">
                <label className="block text-sm font-medium">Reason for drop</label>
                <input
                  name="reason"
                  required
                  minLength={3}
                  placeholder="e.g. Requested withdrawal, timetable clash"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <DropButton />
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
            {state && !state.success && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {/* e.g. "Cannot drop an enrollment with recorded grades or submissions." */}
                {state.error}
              </p>
            )}
            {state && state.success && (
              <p role="status" className="mt-2 text-sm text-green-700">
                Enrollment dropped.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function RosterTable({
  courseOfferingId,
  enrollments,
}: {
  courseOfferingId: string;
  enrollments: RosterEnrollment[];
}) {
  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground">No students enrolled yet.</p>;
  }

  return (
    <table className="w-full overflow-hidden rounded-md border text-left">
      <thead className="bg-muted/50">
        <tr>
          <th className="p-3 text-sm font-medium">Student</th>
          <th className="p-3 text-sm font-medium">Status</th>
          <th className="p-3" />
        </tr>
      </thead>
      <tbody>
        {enrollments.map((e) => (
          <DropRow key={e.id} enrollment={e} courseOfferingId={courseOfferingId} />
        ))}
      </tbody>
    </table>
  );
}