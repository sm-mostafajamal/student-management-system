"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateAssessmentAction,
  deactivateAssessmentAction,
} from "@/app/actions/assessment-actions";
import { AssessmentType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EditAssessmentFormProps {
  assessment: {
    id: string;
    title: string;
    type: AssessmentType;
    weightPercentage: number;
    maxScore: number;
    dueDate: Date;
    gracePeriodMinutes: number;
    maxAttempts: number;
  };
  /** Grading shape (weight/maxScore/type) becomes locked once submissions exist. */
  hasSubmissions: boolean;
}

function toLocalDateTimeInputValue(date: Date): string {
  // datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, not ISO/UTC.
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function EditAssessmentForm({ assessment, hasSubmissions }: EditAssessmentFormProps) {
  const [state, formAction, isPending] = useActionState(updateAssessmentAction, null);
  const inputClass =
    "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="assessmentId" value={assessment.id} />

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={assessment.title}
            required
            className={inputClass}
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
            defaultValue={assessment.type}
            disabled={hasSubmissions}
            className={inputClass}
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
            <label
              htmlFor="weightPercentage"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Weight (%)
            </label>
            <input
              id="weightPercentage"
              name="weightPercentage"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={assessment.weightPercentage}
              disabled={hasSubmissions}
              required
              className={inputClass}
            />
            {state && !state.success && state.fieldErrors?.weightPercentage && (
              <p className="mt-1 text-sm text-red-600">{state.fieldErrors.weightPercentage[0]}</p>
            )}
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
              defaultValue={assessment.maxScore}
              disabled={hasSubmissions}
              required
              className={inputClass}
            />
          </div>
        </div>

        {hasSubmissions && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Type, weight, and max score are locked because students have already submitted work
            against this assessment.
          </p>
        )}

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="datetime-local"
            defaultValue={toLocalDateTimeInputValue(assessment.dueDate)}
            required
            className={inputClass}
          />
          {state && !state.success && state.fieldErrors?.dueDate && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.dueDate[0]}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              defaultValue={assessment.gracePeriodMinutes}
              className={inputClass}
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
              defaultValue={assessment.maxAttempts}
              className={inputClass}
            />
          </div>
        </div>

        {state && !state.success && !state.fieldErrors && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state && state.success && <p className="text-sm text-emerald-600">Assessment updated.</p>}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          <DeactivateAssessmentDialog assessmentId={assessment.id} assessmentTitle={assessment.title} />
        </div>
      </form>
    </div>
  );
}

function DeactivateAssessmentDialog({
  assessmentId,
  assessmentTitle,
}: {
  assessmentId: string;
  assessmentTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assessmentId", assessmentId);
      const result = await deactivateAssessmentAction(null, formData);
      if (result.success) {
        toast.success(`"${assessmentTitle}" was deactivated.`);
        setOpen(false);
        router.push("/assessments");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button type="button" variant="destructive">
          Deactivate assessment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate this assessment?</DialogTitle>
          <DialogDescription>
            This soft-deletes <strong>{assessmentTitle}</strong>. It will no longer accept new
            submissions or count toward the course offering&apos;s 100% weighting cap. Existing
            submissions and recorded grades are preserved, not erased.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}