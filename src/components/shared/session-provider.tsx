"use client";

/**
 * Client-side session context.
 *
 * Provides the current SessionUser (role, id, name) to all client components
 * without prop drilling. The initial value is passed from the Server Component
 * layout (which reads the cookie on the server), so there's no loading flash.
 *
 * The `switchRole` function calls POST /api/role and then hard-navigates to
 * force a full server re-render with the new session cookies — necessary
 * because App Router Server Components read cookies at request time, not
 * reactively.
 *
 * SRP: This context only manages role/session state. It does not fetch
 * student profiles, fees, or any domain data — those are concerns of
 * individual pages and their own Server Components.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import type { SessionUser } from "@/types";

interface SessionContextValue {
  user: SessionUser | null;
  isStaff: boolean;
  isStudent: boolean;
  switchRole: (role: Role, userId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSwitching: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
  initialUser: SessionUser | null;
}

export function SessionProvider({ children, initialUser }: SessionProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [isSwitching, setIsSwitching] = useState(false);

  // useState(initialUser) only applies on first mount. If this provider
  // ever survives a client-side navigation (e.g. a future soft nav path),
  // this keeps context in sync with whatever the server most recently
  // read from the cookie, instead of silently going stale.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const switchRole = useCallback(
    async (role: Role, userId?: string) => {
      setIsSwitching(true);
      try {
        const res = await fetch("/api/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, userId }),
        });

        const data = (await res.json()) as { success: boolean; data?: SessionUser; error?: string };

        if (!data.success) {
          console.error("[SessionProvider.switchRole]", data.error);
          return;
        }

        setUser(data.data ?? null);
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        console.error("[SessionProvider.switchRole]", err);
      } finally {
        setIsSwitching(false);
      }
    },
    [router]
  );

  const signOut = useCallback(async () => {
    await fetch("/api/role", { method: "DELETE" });
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value: SessionContextValue = {
    user,
    isStaff: user?.role === Role.STAFF,
    isStudent: user?.role === Role.STUDENT,
    switchRole,
    signOut,
    isSwitching,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Hook — throws if used outside <SessionProvider>. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return ctx;
}