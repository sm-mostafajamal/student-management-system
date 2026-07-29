"use client";

/**
 * Top header bar — rendered inside every app page.
 * Contains: page title area (injected by children via a title prop),
 * theme toggle, and a notification bell placeholder.
 */

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Bell } from "lucide-react";
import { useSession } from "@/components/shared/session-provider";

interface HeaderProps {
  title?: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { user } = useSession();

  return (
    <header className="
      sticky top-0 z-10 flex h-16 items-center justify-between
      border-b border-border bg-background/95 backdrop-blur-sm
      px-6
    ">
      {/* Left: page title */}
      <div>
        {title && (
          <h1 className="text-lg font-semibold text-foreground leading-none">
            {title}
          </h1>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Notification bell — placeholder for future feature */}
        <button
          type="button"
          className="
            inline-flex h-9 w-9 items-center justify-center rounded-md
            text-muted-foreground hover:text-foreground hover:bg-accent
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <ThemeToggle />

        {user && (
          <div className="
            ml-2 flex items-center gap-2 rounded-md border border-border
            bg-muted/40 px-3 py-1.5
          ">
            <span className="text-xs font-medium text-foreground">
              {user.firstName}
            </span>
            <span className={`
              text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5
              ${user.role === "STAFF"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              }
            `}>
              {user.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}