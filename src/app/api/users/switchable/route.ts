/**
 * GET /api/users/switchable
 *
 * Demo-only convenience endpoint — lists every active Staff and Student
 * user so the header's "Switch user" control can jump straight into a
 * specific person's session (POST /api/role already supports { role, userId },
 * this just supplies the list of choices).
 *
 * Requires SOME active session (staff or student) so this isn't a fully
 * public roster endpoint — consistent with the rest of the app's
 * "auth optional, but not auth absent" posture.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const requester = await getSessionUser();
  if (!requester) {
    return NextResponse.json(
      { success: false, error: "Sign in first." },
      { status: 401 }
    );
  }

  const [staff, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.STAFF, isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: Role.STUDENT, isActive: true, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: { select: { studentNumber: true, status: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      staff: staff.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      })),
      students: students.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        studentNumber: u.studentProfile?.studentNumber ?? "—",
        status: u.studentProfile?.status ?? null,
      })),
    },
  });
}