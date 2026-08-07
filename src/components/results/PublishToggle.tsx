"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { publishResultAction, unpublishResultAction } from "@/app/actions/result-actions";

interface PublishToggleProps {
  gradeId: string;
  isPublished: boolean;
  version: number;
}

export function PublishToggle({ gradeId, isPublished, version }: PublishToggleProps) {
  const [publishState, publishAction, isPublishing] = useActionState(
    publishResultAction,
    null
  );
  const [unpublishState, unpublishAction, isUnpublishing] = useActionState(
    unpublishResultAction,
    null
  );

  useEffect(() => {
    if (!publishState) return;
    if (publishState.success) {
      toast.success("Result published to student.");
    } else if (publishState.error) {
      toast.error(publishState.error);
    }
  }, [publishState]);

  useEffect(() => {
    if (!unpublishState) return;
    if (unpublishState.success) {
      toast.success("Result withheld from student.");
    } else if (unpublishState.error && !unpublishState.fieldErrors?.reason) {
      toast.error(unpublishState.error);
    }
  }, [unpublishState]);

  if (isPublished) {
    return (
      <form action={unpublishAction} className="flex items-center gap-2">
        <input type="hidden" name="gradeId" value={gradeId} />
        <input type="hidden" name="expectedVersion" value={version} />
        <input
          name="reason"
          type="text"
          required
          minLength={5}
          title="At least 5 characters"
          placeholder="Reason to withhold (min 5 chars)"
          className="w-48 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={isUnpublishing}
          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {isUnpublishing ? "Withholding…" : "Withhold"}
        </button>
        {unpublishState && !unpublishState.success && (
          <span className="text-xs text-red-600">
            {unpublishState.fieldErrors?.reason?.[0] ?? unpublishState.error}
          </span>
        )}
      </form>
    );
  }

  return (
    <form action={publishAction} className="flex items-center gap-2">
      <input type="hidden" name="gradeId" value={gradeId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <button
        type="submit"
        disabled={isPublishing}
        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isPublishing ? "Publishing…" : "Publish"}
      </button>
      {publishState && !publishState.success && (
        <span className="text-xs text-red-600">{publishState.error}</span>
      )}
    </form>
  );
}