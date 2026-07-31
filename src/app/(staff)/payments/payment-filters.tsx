"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PaymentMethod } from "@/types";
import { Route } from "next";

const STATUSES = ["COMPLETED", "FAILED", "REVERSED"] as const;

export function PaymentFilters({
  selected,
}: {
  selected: {
    search?: string;
    method?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1"); // any filter change resets pagination
    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Student</label>
        <input
          defaultValue={selected.search ?? ""}
          onBlur={(e) => update("search", e.target.value)}
          placeholder="Name or student number"
          className="mt-1 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Method</label>
        <select
          value={selected.method ?? ""}
          onChange={(e) => update("method", e.target.value)}
          className="mt-1 rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All methods</option>
          {Object.values(PaymentMethod).map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Status</label>
        <select
          value={selected.status ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className="mt-1 rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          defaultValue={selected.dateFrom ?? ""}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="mt-1 rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          defaultValue={selected.dateTo ?? ""}
          onChange={(e) => update("dateTo", e.target.value)}
          className="mt-1 rounded-md border px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}