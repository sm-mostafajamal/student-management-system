/**
 * Universal dashboard entry — redirects to the role-specific dashboard.
 *
 * Both roles land at /dashboard. The Server Component reads the session and
 * renders the appropriate dashboard content. This is preferable to separate
 * routes (/staff/dashboard, /student/dashboard) because the sidebar links
 * to "/dashboard" regardless of role — one URL, role-differentiated content.
 */

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/role";
import {Role} from "@prisma/client";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await getSessionUser();

  if (!session) {
    redirect("/");
  }

  return session.role === Role.STAFF ? (
    <StaffDashboard session={session} />
  ) : (
    <StudentDashboard session={session} />
  );
}