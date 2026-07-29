/**
 * Staff dashboard — Server Component.
 * Runs parallel DB queries for KPI stats, then passes serialized data
 * to the client-side display layer.
 *
 * Data fetched directly (not via service layer) because:
 * - These are aggregate COUNT queries, not domain operations
 * - No business logic, just read + serialize
 *
 * All Prisma Decimal values are converted before the RSC boundary.
 */

import {
  Users, GraduationCap, CreditCard, AlertTriangle,
  BookOpen, TrendingUp, Clock,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatCard, StatCardGrid } from "./stat-card";
import prisma from "@/lib/prisma";
import { StudentStatus, EnrollmentStatus } from "@prisma/client";
import type { SessionUser } from "@/types";
import { formatDate } from "@/lib/utils";
import { countOverdueFees } from "@/services/fee.service";

interface StaffDashboardProps {
  session: SessionUser;
}

export async function StaffDashboard({ session }: StaffDashboardProps) {
  // Parallel queries — don't await sequentially
  const [
    totalStudents,
    activeStudents,
    newThisMonth,
    totalEnrollments,
    overdueFeesCount,
    pendingGrades,
    recentStudents,
    currentAcademicYear,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null, status: StudentStatus.ENROLLED } }),
    prisma.student.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.enrollment.count({ where: { status: EnrollmentStatus.ENROLLED } }),
    // Computed live from dueDate + balance (same logic as listOverdueFees()
    // in fee.service.ts), not from the cached Fee.status column — that
    // cache is only refreshed by syncFeeStatus() after a payment/reversal
    // event, so a fee that simply passes its dueDate with no payment
    // activity would stay invisible to this KPI until an unrelated
    // payment touched it.
    countOverdueFees(),
    prisma.grade.count({ where: { isPublished: false } }),
    prisma.student.findMany({
      where: { deletedAt: null },
      include: { user: true, programme: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
  ]);

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={`Welcome back, ${session.firstName}`}
        description={currentAcademicYear
          ? `Academic Year ${currentAcademicYear.name} — Registry Dashboard`
          : "Registry Dashboard"
        }
      />

      <div className="flex-1 px-6 py-6 space-y-6">

        {/* KPI row */}
        <StatCardGrid>
          <StatCard
            label="Total Students"
            value={totalStudents.toLocaleString()}
            icon={Users}
            description={`${activeStudents} active`}
            variant="default"
          />
          <StatCard
            label="New This Month"
            value={newThisMonth}
            icon={TrendingUp}
            description="admissions"
            variant="success"
          />
          <StatCard
            label="Active Enrollments"
            value={totalEnrollments.toLocaleString()}
            icon={BookOpen}
            description="across all courses"
            variant="default"
          />
          <StatCard
            label="Overdue Fees"
            value={overdueFeesCount}
            icon={AlertTriangle}
            description="require action"
            variant={overdueFeesCount > 0 ? "danger" : "success"}
          />
        </StatCardGrid>

        {/* Secondary metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard
            label="Unpublished Grades"
            value={pendingGrades}
            icon={Clock}
            description="awaiting publication"
            variant={pendingGrades > 0 ? "warning" : "success"}
          />
          <StatCard
            label="Programmes"
            value="—"
            icon={GraduationCap}
            description="load dynamically"
            variant="default"
          />
          <StatCard
            label="Fee Collections"
            value="—"
            icon={CreditCard}
            description="this semester"
            variant="default"
          />
        </div>

        {/* Recent admissions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Admissions</h2>
            <a
              href="/students"
              className="text-xs text-primary hover:underline font-medium"
            >
              View all →
            </a>
          </div>

          {recentStudents.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No students yet. Run the seed script to populate demo data.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                    {student.user.firstName[0]}{student.user.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {student.user.firstName} {student.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.studentNumber} · {student.programme.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`
                      inline-block text-[10px] font-semibold uppercase tracking-wider
                      rounded px-2 py-0.5
                      ${student.status === "ENROLLED"
                        ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                        : "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]"
                      }
                    `}>
                      {student.status}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(student.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}