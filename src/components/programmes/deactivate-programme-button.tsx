"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { updateProgrammeAction } from "@/actions/programme.actions";
import { toggleProgrammeStatusAction } from "@/actions/programme.actions";

interface Props {
  programme: { id: string; code: string; name: string; isActive: boolean };
}

/**
 * Renders a "Deactivate" or "Reactivate" button.
 * Deactivation shows an inline confirmation step — this extra click prevents
 * accidental deactivation since the action checks for active students server-side.
 */
export function DeactivateProgrammeButton({ programme }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

 const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", programme.id);
      fd.set("isActive", String(!programme.isActive));

      const result = await toggleProgrammeStatusAction(null, fd);
      if (result.success) {
        setConfirming(false);
      } else {
        setError(result.error);
        setConfirming(false);
      }
    });
  };

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (confirming && programme.isActive) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-700/40 dark:bg-amber-900/20">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
          Deactivate <strong>{programme.name}</strong>? Students cannot enroll while a programme is inactive.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="rounded px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Deactivate
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={programme.isActive ? () => setConfirming(true) : handleToggle}
      disabled={isPending}
      className={
        programme.isActive
          ? "flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-400"
          : "flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      }
    >
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {programme.isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}