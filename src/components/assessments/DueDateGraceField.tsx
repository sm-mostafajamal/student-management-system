// src/components/assessments/DueDateGraceField.tsx
"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

function toLocalDateTimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "already passed";
  const mins = Math.round(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (remMins || parts.length === 0) parts.push(`${remMins}m`);
  return `in ${parts.join(" ")}`;
}

const QUICK_PICKS: { label: string; addMs: number }[] = [
  { label: "+1 day", addMs: 24 * 60 * 60_000 },
  { label: "+3 days", addMs: 3 * 24 * 60 * 60_000 },
  { label: "+1 week", addMs: 7 * 24 * 60 * 60_000 },
  { label: "+2 weeks", addMs: 14 * 24 * 60 * 60_000 },
];

export function DueDateGraceField({
  defaultDueDate,
  defaultGracePeriodMinutes = 0,
  dueDateError,
  disabled = false,
}: {
  defaultDueDate?: Date;
  defaultGracePeriodMinutes?: number;
  dueDateError?: string;
  disabled?: boolean;
}) {
  const [dueDateValue, setDueDateValue] = useState<string>(
    defaultDueDate ? toLocalDateTimeInputValue(defaultDueDate) : ""
  );
  const [graceMinutes, setGraceMinutes] = useState<number>(defaultGracePeriodMinutes);

  const dueDate = useMemo(() => fromLocalDateTimeInputValue(dueDateValue), [dueDateValue]);
  const deadline = useMemo(
    () => (dueDate ? new Date(dueDate.getTime() + graceMinutes * 60_000) : null),
    [dueDate, graceMinutes]
  );

  function applyQuickPick(addMs: number) {
    setDueDateValue(toLocalDateTimeInputValue(new Date(Date.now() + addMs)));
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="dueDate"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Due date
        </label>

        <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900">
          <CalendarClock className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            id="dueDate"
            name="dueDate"
            type="datetime-local"
            required
            disabled={disabled}
            value={dueDateValue}
            onChange={(e) => setDueDateValue(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>

        {!disabled && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_PICKS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => applyQuickPick(q.addMs)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {dueDateError && <p className="mt-1 text-sm text-red-600">{dueDateError}</p>}
      </div>

      <div>
        <label
          htmlFor="gracePeriodMinutes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Grace period (minutes)
        </label>
        <input
          id="gracePeriodMinutes"
          name="gracePeriodMinutes"
          type="number"
          min={0}
          disabled={disabled}
          value={graceMinutes}
          onChange={(e) => setGraceMinutes(Number(e.target.value) || 0)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />

        {/* Live-updating preview — recalculates on every keystroke, current-time vs due time */}
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {deadline ? (
            <>
              Submissions lock at{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {deadline.toLocaleString()}
              </span>{" "}
              ({formatDuration(deadline.getTime() - Date.now())}
              {graceMinutes > 0 && ` — includes ${graceMinutes}m grace`})
            </>
          ) : (
            "Pick a due date to see when submissions will lock."
          )}
        </p>
      </div>
    </div>
  );
}