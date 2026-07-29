"use client";

import { useState, useTransition } from "react";
import { assignFeesToStudentAction } from "@/actions/fee.actions";

const SEMESTERS = ["FIRST_SEMESTER", "SECOND_SEMESTER", "SUMMER_SEMESTER"] as const;

export function AssignFeesButton({ studentId, academicYearId }: { studentId: string; academicYearId?: string }) {
  const [open, setOpen] = useState(false);
  const [semester, setSemester] = useState<(typeof SEMESTERS)[number]>("FIRST_SEMESTER");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!academicYearId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        Assign fees
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value as (typeof SEMESTERS)[number])}
            className="mt-1 mb-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await assignFeesToStudentAction({ studentId, academicYearId, semester });
                setMessage(result.success ? `Billed ${result.data.created} item(s).` : result.error);
              })
            }
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "Assigning..." : "Confirm"}
          </button>
          {message && <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{message}</p>}
        </div>
      )}
    </div>
  );
}