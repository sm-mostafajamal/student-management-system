"use client";

import { useState, useTransition } from "react";
import { createFeeStructureAction } from "@/actions/fee.actions";

const SEMESTERS = ["FIRST_SEMESTER", "SECOND_SEMESTER", "SUMMER_SEMESTER"] as const;
const CATEGORIES = ["TUITION", "LIBRARY", "EXAMINATION", "HOSTEL", "MEDICAL", "REGISTRATION", "FINE", "OTHER"] as const;

export function FeeStructureForm({
  programmes,
  academicYears,
}: {
  programmes: { id: string; name: string }[];
  academicYears: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      action={(formData: FormData) => {
        setError(null);
        startTransition(async () => {
          const result = await createFeeStructureAction({
            programmeId: formData.get("programmeId"),
            academicYearId: formData.get("academicYearId"),
            semester: formData.get("semester"),
            category: formData.get("category"),
            amount: formData.get("amount"),
          });
          if (!result.success) setError(result.error);
        });
      }}
    >
      <select
        name="programmeId"
        required
        className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {programmes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        name="academicYearId"
        required
        className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {academicYears.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
      <select
        name="semester"
        required
        className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {SEMESTERS.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <select
        name="category"
        required
        className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace("_", " ")}
          </option>
        ))}
      </select>
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        required
        placeholder="Amount"
        className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        disabled={isPending}
        className="col-span-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-5"
      >
        {isPending ? "Saving..." : "Add fee structure"}
      </button>
      {error && <p className="col-span-2 text-sm text-red-600 dark:text-red-400 sm:col-span-5">{error}</p>}
    </form>
  );
}