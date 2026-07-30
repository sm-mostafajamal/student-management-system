"use client";

/**
 * "Switch user" control — lets you jump into any specific staff or student's
 * session, instead of always landing on "first active user of that role"
 * (which is all the plain role-toggle picker gives you).
 *
 * Fetches the list lazily (only when the dropdown is opened) rather than on
 * every page load, since it's a convenience/demo feature, not core data.
 */

import { useState } from "react";
import { ChevronDown, Loader2, UserCircle2 } from "lucide-react";
import { Role } from "@prisma/client";
import { useSession } from "@/components/shared/session-provider";

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

export function UserSwitcher() {
  const { user, switchRole, isSwitching } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<SwitchableStaff[] | null>(null);
  const [students, setStudents] = useState<SwitchableStudent[] | null>(null);

  async function handleOpen() {
    setOpen((prev) => !prev);
    if (staff || loading) return; // already loaded (or loading)

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

  async function handlePick(role: Role, userId: string) {
    setOpen(false);
    await switchRole(role, userId);
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        disabled={isSwitching}
        className="
          flex items-center gap-1.5 rounded-md border border-border
          bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground
          hover:bg-accent transition-colors disabled:opacity-60
        "
      >
        <UserCircle2 className="h-3.5 w-3.5" />
        Switch user
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          {/* click-outside overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="
              absolute right-0 z-20 mt-2 w-72 max-h-96 overflow-y-auto
              rounded-lg border border-border bg-popover shadow-lg
            "
          >
            {loading && (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {error && <p className="p-3 text-sm text-destructive">{error}</p>}

            {staff && staff.length > 0 && (
              <div className="p-1">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff
                </p>
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePick(Role.STAFF, s.id)}
                    className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.email}</span>
                  </button>
                ))}
              </div>
            )}

            {students && students.length > 0 && (
              <div className="border-t border-border p-1">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Students
                </p>
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePick(Role.STUDENT, s.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span>
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{s.studentNumber}</span>
                    </span>
                    {s.status && s.status !== "ENROLLED" && (
                      <span className="text-[10px] uppercase text-muted-foreground">{s.status}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}