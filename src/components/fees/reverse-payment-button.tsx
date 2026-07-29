"use client";

import { useState, useTransition } from "react";
import { reversePaymentAction } from "@/actions/payment.actions";

export function ReversePaymentButton({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
        Reverse
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (min 5 chars)"
        className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        disabled={isPending || reason.trim().length < 5}
        onClick={() =>
          startTransition(async () => {
            const result = await reversePaymentAction({ paymentId, reversalReason: reason });
            if (!result.success) setError(result.error);
            else setOpen(false);
          })
        }
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40 dark:text-red-400"
      >
        Confirm
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}