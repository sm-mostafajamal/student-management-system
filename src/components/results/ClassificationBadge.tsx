import type { ResultClassification } from "@/types";

const STYLES: Record<ResultClassification, string> = {
  DISTINCTION:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  MERIT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PASS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const LABELS: Record<ResultClassification, string> = {
  DISTINCTION: "Distinction",
  MERIT: "Merit",
  PASS: "Pass",
  FAIL: "Fail",
};

export function ClassificationBadge({
  classification,
}: {
  classification: ResultClassification;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[classification]}`}
    >
      {LABELS[classification]}
    </span>
  );
}