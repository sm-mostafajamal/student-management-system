"use client";

/**
 * First screen an assessor sees — pick a demo role to enter the system.
 * Calls POST /api/role and redirects on success.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Users, ChevronRight, Loader2 } from "lucide-react";
import { Role } from "@prisma/client";
import { ThemeToggle } from "./theme-toggle";

export function LandingRolePicker() {
  const router = useRouter();
  const [loading, setLoading] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleSelect(role: Role) {
    setLoading(role);
    setError(null);

    try {
      const res = await fetch("/api/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json() as { success: boolean; error?: string };

      if (!data.success) {
        setError(data.error ?? "Failed to set role. Is the seed script run?");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check the server is running.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Theme toggle top-right */}
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          {/* Brand */}
          <div className="text-center space-y-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <GraduationCap className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">PEN Global</h1>
            <p className="text-muted-foreground text-sm">
              Student Registry System
            </p>
          </div>

          {/* Role cards */}
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Select a demo role to continue
            </p>

            <button
              onClick={() => handleRoleSelect(Role.STAFF)}
              disabled={loading !== null}
              className="
                w-full flex items-center gap-4 rounded-xl border border-border
                bg-card p-5 text-left shadow-sm
                hover:border-primary/50 hover:shadow-md
                transition-all duration-150
                disabled:opacity-60 disabled:cursor-not-allowed
                focus-visible:ring-2 focus-visible:ring-ring
              "
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Registry Staff</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage students, fees, grades, and enrolments
                </p>
              </div>
              {loading === Role.STAFF ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <button
              onClick={() => handleRoleSelect(Role.STUDENT)}
              disabled={loading !== null}
              className="
                w-full flex items-center gap-4 rounded-xl border border-border
                bg-card p-5 text-left shadow-sm
                hover:border-primary/50 hover:shadow-md
                transition-all duration-150
                disabled:opacity-60 disabled:cursor-not-allowed
                focus-visible:ring-2 focus-visible:ring-ring
              "
            >
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Student</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  View courses, grades, and fee statements
                </p>
              </div>
              {loading === Role.STUDENT ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}