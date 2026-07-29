// src/lib/auth-helpers.ts
/**
 * Auth helpers for Server Actions and Route Handlers.
 * Reads the demo session/role from cookies (see src/lib/role.ts) — this
 * project uses a role-toggle instead of real authentication, per the
 * assessment's "auth optional" constraint.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export async function getSession() {
  const user = await getSessionUser();
  return user ? { user } : null;
}

/** Redirects to the landing page if no demo role/user is active. */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/");
  }
  return session;
}

/** Redirects to /dashboard if the active demo user isn't STAFF. */
export async function requireStaff() {
  const session = await requireAuth();
  if (session.user.role !== "STAFF") {
    redirect("/dashboard");
  }
  return session;
}