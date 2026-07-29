/**
 * Reusable metric card — renders a KPI tile with an icon, value, and label.
 * Used by both StaffDashboard and StudentDashboard.
 *
 * `trend` is optional: pass a positive number for green, negative for red.
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: number; // positive = good, negative = bad
  variant?: "default" | "success" | "warning" | "danger";
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  variant = "default",
  loading = false,
}: StatCardProps) {
  const iconStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]",
    warning: "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]",
    danger: "bg-[hsl(var(--error-bg))] text-[hsl(var(--error))]",
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-9 w-9 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-20" />
        <div className="skeleton h-3 w-32" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("rounded-lg p-2", iconStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>

      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <span
            className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--error))]"
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}


export function StatCardGrid({ children, className }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {children}
    </div>
  );
}