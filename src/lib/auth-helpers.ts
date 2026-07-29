/**
 * Auth helpers for Server Actions and Route Handlers.
 *
 * Centralised here so all actions call one function and we can swap auth
 * providers (NextAuth → Clerk → custom) in one place.
 *
 * If you are using NextAuth v5 (Auth.js), replace the body with:
 *   import { auth } from "@/auth";
 *   const session = await auth();
 */

import { auth } from "@/auth"; // adjust to your auth import
import { redirect } from "next/navigation";

export async function getSession() {
  return auth();
}

/** Throws a redirect to /login if the user is not authenticated. */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Throws a redirect to /unauthorized if the user is not STAFF or ADMIN.
 * Used by every write Server Action in this module.
 */
export async function requireStaff() {
  const session = await requireAuth();
  const role = (session.user as { role?: string }).role;
  if (role !== "STAFF" && role !== "ADMIN") {
    redirect("/unauthorized");
  }
  return session;
}