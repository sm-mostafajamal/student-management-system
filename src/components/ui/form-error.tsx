import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorProps {
  message?: string | null;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Inline field-level error shown below an input */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}