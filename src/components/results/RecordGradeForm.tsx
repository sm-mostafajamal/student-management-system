"use client";

import { useActionState, useState } from "react";
import { recordGradeAction, computeAndSaveGradeAction } from "@/app/actions/result-actions";
import type { AssessmentContribution } from "@/services/result.service";
import { classifyScore } from "@/types";

interface RecordGradeFormProps {
  studentId: string;
  courseOfferingId: string;
  currentScore: number | null;
  isPublished: boolean;
  version: number | null;
  computedScore: number | null;
  isComplete: boolean;
  gradedCount: number;
  totalCount: number;
  breakdown: AssessmentContribution[];
}

export function RecordGradeForm({
  studentId,
  courseOfferingId,
  currentScore,
  isPublished,
  version,
  computedScore,
  isComplete,
  gradedCount,
  totalCount,
  breakdown,
}: RecordGradeFormProps) {
  const [computeState, computeAction, isComputing] = useActionState(computeAndSaveGradeAction, null);
  const [manualState, manualAction, isSavingManual] = useActionState(recordGradeAction, null);
  const [showManualOverride, setShowManualOverride] = useState(false);

  return (
    <div className="space-y-4">
      {totalCount > 0 && (
        <ul className="space-y-1 rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900">
          {breakdown.map((a) => (
            <li key={a.assessmentId} className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                {a.title} <span className="text-gray-400">({a.weightPercentage}% of final grade)</span>
              </span>
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {a.score != null ? `${a.score}/${a.maxScore} → ${a.contribution}%` : "not graded yet"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Currently saved final grade
        </span>
        <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">
            {currentScore !== null
            ? `${currentScore} / 100 — ${classifyScore(currentScore)}`
            : "Not saved yet"}
        </p>
        </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Computed final grade</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {computedScore !== null ? `${computedScore} / 100` : "—"}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {gradedCount} / {totalCount} assessment(s) graded
            {!isComplete && totalCount > 0 && " — provisional until all assessments are marked"}
          </p>
        </div>

        <form action={computeAction}>
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="courseOfferingId" value={courseOfferingId} />
          {version !== null && <input type="hidden" name="expectedVersion" value={version} />}
          {isPublished && (
            <input type="hidden" name="reason" value="Recomputed from updated assessment scores." />
          )}
          <button
            type="submit"
            disabled={isComputing || computedScore === null}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isComputing ? "Saving…" : currentScore === null ? "Save as Final Grade" : "Recompute & Update"}
          </button>
        </form>
      </div>

      {computeState?.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Final grade saved from assessment scores. Click "Publish" above to release it to the student.
        </p>
      )}
      {computeState && !computeState.success && (
        <p className="text-sm text-red-600 dark:text-red-400">{computeState.error}</p>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowManualOverride((v) => !v)}
          className="text-xs font-medium text-gray-500 underline hover:text-gray-700 dark:text-gray-400"
        >
          {showManualOverride ? "Hide manual override" : "Need to override this score manually?"}
        </button>

        {showManualOverride && (
          <form
            action={manualAction}
            className="mt-2 space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700"
          >
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="courseOfferingId" value={courseOfferingId} />
            {version !== null && <input type="hidden" name="expectedVersion" value={version} />}

            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Override score (0–100)
                </label>
                <input
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
                disabled={isSavingManual}
                className="inline-flex items-center rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-gray-500 disabled:opacity-50"
              >
                {isSavingManual ? "Saving…" : "Save override"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Reason (required — always audited for manual overrides)
              </label>
              <input
                name="reason"
                type="text"
                required
                placeholder="e.g. academic integrity penalty, grade moderation"
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            {manualState?.success && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Override saved{isPublished ? " — this result has been automatically withheld until you republish it." : "."}
                </p>
            )}
            {manualState && !manualState.success && (
                <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    <p>{manualState.error}</p>
                    {manualState.fieldErrors &&
                    Object.entries(manualState.fieldErrors).map(([field, errors]) => (
                        <p key={field} className="text-xs">
                        <span className="font-medium">{field}:</span> {errors?.[0]}
                        </p>
                    ))}
                </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}