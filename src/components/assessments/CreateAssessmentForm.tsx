"use client";

import { useActionState } from "react";
import { createAssessmentAction } from "@/app/actions/assessment-actions";
import { AssessmentType } from "@/types";

export function CreateAssessmentForm({ courseOfferingId }: { courseOfferingId: string }) {
  const [state, formAction, isPending] = useActionState(createAssessmentAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="courseOfferingId" value={courseOfferingId} />

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {state && !state.success && state.fieldErrors?.title && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Type
        </label>
        <select
          id="type"
          name="type"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {Object.values(AssessmentType).map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="weightPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Weight (%)
          </label>
          <input
            id="weightPercentage"
            name="weightPercentage"
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Max score
          </label>
          <input
            id="maxScore"
            name="maxScore"
            type="number"
            min={1}
            step="0.01"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Due date
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="datetime-local"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        {state && !state.success && state.fieldErrors?.dueDate && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.dueDate[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="gracePeriodMinutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Grace period (minutes)
          </label>
          <input
            id="gracePeriodMinutes"
            name="gracePeriodMinutes"
            type="number"
            min={0}
            defaultValue={0}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label htmlFor="maxAttempts" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Max attempts
          </label>
          <input
            id="maxAttempts"
            name="maxAttempts"
            type="number"
            min={1}
            max={10}
            defaultValue={1}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Set to 2+ to allow resubmission before the deadline.
          </p>
        </div>
      </div>

      {state && !state.success && !state.fieldErrors && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && state.success && <p className="text-sm text-emerald-600">Assessment created.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create assessment"}
      </button>
    </form>
  );
}