/**
 * Role toggle endpoint.
 * POST /api/role — switches the active session role.
 *
 * Per assessment constraints, this replaces real authentication.
 * The endpoint:
 * 1. Validates the requested role is a known enum value
 * 2. Finds a matching demo user in the DB for that role
 * 3. Writes the user + role to HTTP-only cookies
 * 4. Returns 200 with the new session
 *
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { ROLE_COOKIE, USER_COOKIE, serializeSessionUser } from "@/lib/role";
import { handleServiceError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import type { SessionUser } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { role?: string; userId?: string };

    // Validate role
    const role = body.role as Role;
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }

    // Find the target user — either a specific userId or any active demo user
    // with that role. This is the seam where real auth would hook in.
    let user;

    if (body.userId) {
      user = await prisma.user.findFirst({
        where: { id: body.userId, role, isActive: true, deletedAt: null },
        include: { studentProfile: true },
      });
    } else {
      // Fall back to first active user with that role (demo convenience)
      user = await prisma.user.findFirst({
        where: { role, isActive: true, deletedAt: null },
        include: { studentProfile: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: `No active ${role} user found. Run the seed script first.`,
        },
        { status: 404 }
      );
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      ...(user.studentProfile ? { studentId: user.studentProfile.id } : {}),
    };

    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    };

    cookieStore.set(ROLE_COOKIE, role, cookieOpts);
    cookieStore.set(USER_COOKIE, serializeSessionUser(sessionUser), cookieOpts);

    return NextResponse.json({ success: true, data: sessionUser });
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ROLE_COOKIE);
    cookieStore.delete(USER_COOKIE);

    return NextResponse.json({ success: true, data: null });
  } catch (err) {
    return handleServiceError(err);
  }
}

/** GET — returns current session for client-side hydration */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get(USER_COOKIE);

    if (!userCookie?.value) {
      return NextResponse.json({ success: true, data: null });
    }

    try {
      const session = JSON.parse(userCookie.value) as SessionUser;
      return NextResponse.json({ success: true, data: session });
    } catch {
      return NextResponse.json({ success: true, data: null });
    }
  } catch (err) {
    return handleServiceError(err);
  }
}