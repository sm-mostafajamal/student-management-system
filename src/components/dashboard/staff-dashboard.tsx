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
import { StudentStatus, EnrollmentStatus, PaymentStatus } from "@prisma/client";
import type { SessionUser } from "@/types";
import { formatDate } from "@/lib/utils";
import { countOverdueFees, listOverdueFees } from "@/services/fee.service";

interface StaffDashboardProps {
  session: SessionUser;
}

export async function StaffDashboard({ session }: StaffDashboardProps) {
  // Parallel queries — don't await sequentially
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeStudents,
    newThisMonth,
    totalEnrollments,
    overdueFeesCount,
    overdueFeeRows,
    pendingGrades,
    recentStudents,
    currentAcademicYear,
    collectionsThisMonth,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null, status: StudentStatus.ENROLLED } }),
    prisma.student.count({
      where: {
        deletedAt: null,
        createdAt: { gte: startOfMonth },
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
    // Row-level detail (not just the count) for the "overdue students"
    // panel below — same live dueDate+balance computation.
    listOverdueFees(),
    prisma.grade.count({ where: { isPublished: false } }),
    prisma.student.findMany({
      where: { deletedAt: null },
      include: { user: true, programme: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.COMPLETED, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  // Registry policy: a balance is only "overdue" for the dashboard's
  // attention-worthy list once it's been unpaid 30+ days past its due
  // date, not the instant it lapses — that's the sensible threshold the
  // brief asks for ("balance > 0 and more than 30 days").
  const seriouslyOverdue = overdueFeeRows.filter((r) => r.dueDate < thirtyDaysAgo);

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
            label="30+ Days Overdue"
            value={seriouslyOverdue.length}
            icon={AlertTriangle}
            description="need urgent follow-up"
            variant={seriouslyOverdue.length > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Fee Collections"
            value={Number(collectionsThisMonth._sum.amount ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            icon={CreditCard}
            description="this month"
            variant="success"
          />
        </div>

        {/* Overdue balances */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Overdue Balances</h2>
            <a
              href="/payments"
              className="text-xs text-primary hover:underline font-medium"
            >
              View payments →
            </a>
          </div>

          {overdueFeeRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No overdue balances — everyone is current.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueFeeRows.slice(0, 8).map((row) => {
                const isSeriouslyOverdue = row.dueDate < thirtyDaysAgo;
                return (
                  <a
                    key={row.feeId}
                    href={`/fees/students/${row.studentId}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-[hsl(var(--error-bg))] flex items-center justify-center text-xs font-semibold text-[hsl(var(--error))] flex-shrink-0">
                      {row.firstName[0]}{row.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {row.firstName} {row.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.studentNumber} · {row.category.replace("_", " ")} · due {formatDate(row.dueDate)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-[hsl(var(--error))]">
                        {Number(row.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {isSeriouslyOverdue && (
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 bg-[hsl(var(--error-bg))] text-[hsl(var(--error))]">
                          30+ days
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
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