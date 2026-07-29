"use client";

import { useState, useTransition } from "react";
import { recordPaymentAction } from "@/actions/payment.actions";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "MOBILE_MONEY", "CHEQUE"] as const;

export function RecordPaymentForm({ feeId, balance }: { feeId: string; balance: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (balance <= 0) {
    return <p className="text-sm text-green-700 dark:text-green-400">Fully settled — no balance outstanding.</p>;
  }

  return (
    <form
      className="space-y-3"
      action={(formData: FormData) => {
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          const result = await recordPaymentAction({
            feeId,
            amount: formData.get("amount"),
            method: formData.get("method"),
            reference: formData.get("reference"),
            paidAt: formData.get("paidAt"),
          });
          if (!result.success) setError(result.error);
          else setSuccess(true);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            max={balance}
            min={0.01}
            required
            placeholder={`Max ${balance.toFixed(2)}`}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
          <select
            name="method"
            required
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference</label>
          <input
            name="reference"
            type="text"
            required
            minLength={3}
            placeholder="Receipt / transaction #"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date paid</label>
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-700 dark:text-green-400">Payment recorded.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {isPending ? "Recording..." : "Record payment"}
      </button>
    </form>
  );
}