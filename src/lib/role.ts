
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import type { SessionUser } from "@/types";

export const ROLE_COOKIE = "sms_role" as const;
export const USER_COOKIE = "sms_user" as const;

export const DEFAULT_ROLE: Role = Role.STAFF;


/**
 * Returns the active session user from cookies.
 * Returns null if no user cookie is set (unauthenticated / first visit).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get(USER_COOKIE);

  if (!userCookie?.value) return null;

  try {
    const parsed = JSON.parse(userCookie.value) as SessionUser;
    // Validate the role field is a known enum value — guards against cookie
    // tampering with an unexpected string.
    if (!Object.values(Role).includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Returns just the role without the full user object.
 * Used by middleware and layout for fast role checks.
 */
export async function getActiveRole(): Promise<Role> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(ROLE_COOKIE);

  if (!roleCookie?.value) return DEFAULT_ROLE;

  const value = roleCookie.value as Role;
  return Object.values(Role).includes(value) ? value : DEFAULT_ROLE;
}

/**
 * Builds the serialized user payload for the cookie.
 * Called by the /api/role route handler after switching roles.
 */
export function serializeSessionUser(user: SessionUser): string {
  return JSON.stringify(user);
}

// ─── Role-derived helpers ─────────────────────────────────────────────────────

export function isStaff(role: Role): boolean {
  return role === Role.STAFF;
}

export function isStudent(role: Role): boolean {
  return role === Role.STUDENT;
}

/**
 * Returns the dashboard path for a given role.
 * Centralised so nav, middleware, and post-login redirects all agree.
 */
export function getDashboardPath(role: Role): string {
  return role === Role.STUDENT ? "/dashboard" : "/dashboard";
}