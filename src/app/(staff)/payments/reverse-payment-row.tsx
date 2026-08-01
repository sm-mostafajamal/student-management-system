"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { reversePaymentAction } from "@/app/actions/payment-actions";
import type { PaymentLedgerRow } from "@/services/payment.service";

function ReverseButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-destructive px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      {pending ? "Reversing..." : "Confirm reversal"}
    </button>
  );
}

export function ReversePaymentControl({ payment }: { payment: PaymentLedgerRow }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useActionState(reversePaymentAction, null);

  if (payment.status !== "COMPLETED") {
    // Only COMPLETED payments make sense to reverse. The service itself
    // enforces this (throws on an already-REVERSED payment) — hiding the
    // control here is UX only, not the actual guard.
    return payment.status === "REVERSED" ? (
      <span className="text-xs text-muted-foreground">
        Reversed{payment.reversedByName ? ` by ${payment.reversedByName}` : ""}
        {payment.reversedAt ? ` on ${payment.reversedAt.toLocaleDateString()}` : ""}
      </span>
    ) : null;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-accent"
      >
        Reverse...
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="paymentId" value={payment.id} />
      <input
        name="reversalReason"
        required
        minLength={5}
        placeholder="Reason for reversal (e.g. bounced cheque)"
        className="rounded-md border px-3 py-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <ReverseButton />
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </div>
      {state && !state.success && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state && state.success && (
        <p role="status" className="text-sm text-green-700">
          Payment reversed.
        </p>
      )}
    </form>
  );
}