import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  active: boolean;
  labels?: { active?: string; inactive?: string };
  className?: string;
}

export function StatusBadge({
  active,
  labels = { active: "Active", inactive: "Inactive" },
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-zinc-400"
        )}
      />
      {active ? labels.active : labels.inactive}
    </span>
  );
}