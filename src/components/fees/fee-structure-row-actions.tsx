"use client";

import { useState, useTransition } from "react";
import {
  updateFeeStructureAmountAction,
  deactivateFeeStructureAction,
} from "@/actions/fee.actions";

interface FeeStructureRowActionsProps {
  id: string;
  amount: number;
  isActive: boolean;
}

export function FeeStructureRowActions({ id, amount, isActive }: FeeStructureRowActionsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(String(amount));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isActive) {
    return <span className="text-xs text-gray-400">Deactivated</span>;
  }

  if (isEditing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          autoFocus
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await updateFeeStructureAmountAction({ id, amount: value });
              if (!result.success) {
                setError(result.error);
                return;
              }
              setIsEditing(false);
            });
          }}
          className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setValue(String(amount));
            setIsEditing(false);
          }}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
        >
          Cancel
        </button>
        {error && <p className="w-full text-right text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Deactivate this fee structure? Students already billed from it are unaffected.")) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deactivateFeeStructureAction(id);
            if (!result.success) setError(result.error);
          });
        }}
        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
      >
        {isPending ? "..." : "Deactivate"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}