"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Role } from "@prisma/client";
import { useSession } from "@/components/shared/session-provider";
import { cn } from "@/lib/utils";

interface SwitchableStaff {
  id: string;
  name: string;
  email: string;
}
interface SwitchableStudent {
  id: string;
  name: string;
  studentNumber: string;
  status: string | null;
}

export function SidebarUserSwitcher() {
  const { user, switchRole, isSwitching, isStaff } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<SwitchableStaff[] | null>(null);
  const [students, setStudents] = useState<SwitchableStudent[] | null>(null);
  // Which role's list is showing in the dropdown — defaults to the role
  // currently active, so "click your name" first shows peers like you.
  const [tab, setTab] = useState<Role>(isStaff ? Role.STAFF : Role.STUDENT);

  if (!user) return null;

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !staff && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/users/switchable");
        const json = (await res.json()) as {
          success: boolean;
          error?: string;
          data?: { staff: SwitchableStaff[]; students: SwitchableStudent[] };
        };
        if (!json.success || !json.data) {
          setError(json.error ?? "Couldn't load users.");
          return;
        }
        setStaff(json.data.staff);
        setStudents(json.data.students);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    }
  }

  async function handlePick(role: Role, userId: string) {
    setOpen(false);
    await switchRole(role, userId);
  }

  const list = tab === Role.STAFF ? staff : students;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        disabled={isSwitching}
        className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent disabled:opacity-60"
      >
        <div
          className={cn(
            "h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
            isStaff
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          )}
        >
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-border bg-popover shadow-lg">
            {/* Role tabs — the list below only ever shows ONE role at a time */}
            <div className="flex gap-1 border-b border-border p-1.5">
              <button
                type="button"
                onClick={() => setTab(Role.STAFF)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                  tab === Role.STAFF
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => setTab(Role.STUDENT)}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                  tab === Role.STUDENT
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                Student
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {error && <p className="p-3 text-sm text-destructive">{error}</p>}

              {!loading &&
                !error &&
                tab === Role.STAFF &&
                staff?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePick(Role.STAFF, s.id)}
                    className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.email}</span>
                  </button>
                ))}

              {!loading &&
                !error &&
                tab === Role.STUDENT &&
                students?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePick(Role.STUDENT, s.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span>
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {s.studentNumber}
                      </span>
                    </span>
                    {s.status && s.status !== "ENROLLED" && (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {s.status}
                      </span>
                    )}
                  </button>
                ))}

              {!loading && !error && list?.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No {tab.toLowerCase()}s found.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}