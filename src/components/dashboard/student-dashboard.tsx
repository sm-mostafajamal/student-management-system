/**
 * Student dashboard — Server Component.
 * Reads data for the specific student tied to the session.
 *
 * Edge case handled: if the session says role=STUDENT but there's no
 * matching Student record (bad seed state), we render a friendly error
 * rather than crashing. In production this would be a redirect to an
 * onboarding flow.
 */
import Link from "next/link"; 
import {
  BookMarked, Award, Receipt, TrendingUp,
  CheckCircle, AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatCard, StatCardGrid } from "./stat-card";
import prisma from "@/lib/prisma";
import {
  EnrollmentStatus,
  PaymentStatus,
} from "@prisma/client";
import type { SessionUser } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toNumberRequired } from "@/lib/decimal";
import { GPA_SCALE } from "@/types";
import type { LetterGrade } from "@prisma/client";

interface StudentDashboardProps {
  session: SessionUser;
}

export async function StudentDashboard({ session }: StudentDashboardProps) {
  const studentId = session.studentId;

  if (!studentId) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="text-center space-y-2 max-w-sm">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm font-medium text-foreground">Student profile not found</p>
            <p className="text-xs text-muted-foreground">
              Your account ({session.email}) does not have a student profile.
              Contact the registry office or re-run the seed script.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [
    student,
    enrollments,
    fees,
    publishedGrades,
  ] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { programme: true, user: true },
    }),
    prisma.enrollment.findMany({
      where: { studentId, status: EnrollmentStatus.ENROLLED },
      include: {
        courseOffering: {
          include: { course: true, academicYear: true, instructor: true },
        },
      },
      take: 5,
    }),
    prisma.fee.findMany({
      where: { studentId },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
      },
    }),
    prisma.grade.findMany({
      where: { studentId, isPublished: true },
      include: {
        courseOffering: { include: { course: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
  ]);

  if (!student) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Dashboard" />
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground">Student record not found.</p>
        </div>
      </div>
    );
  }

  // Compute live fee balances
  let totalOwed = 0;
  let totalPaid = 0;
  let hasOverdueFees = false;

  for (const fee of fees) {
    const due = toNumberRequired(fee.amountDue);
    const waived = toNumberRequired(fee.waivedAmount);
    const paid = fee.payments.reduce((s, p) => s + toNumberRequired(p.amount), 0);
    totalOwed += due - waived;
    totalPaid += paid;
    if (due - waived - paid > 0.001 && fee.dueDate && fee.dueDate < new Date()) {
      hasOverdueFees = true;
    }
  }
  const outstandingBalance = Math.max(0, totalOwed - totalPaid);

  // Compute GPA from published grades
  let weightedGpaSum = 0;
  let totalCreditHours = 0;

  for (const grade of publishedGrades) {
    if (grade.letterGrade && grade.letterGrade in GPA_SCALE) {
      const credits = grade.courseOffering.course.creditHours;
      const gpaPoints = GPA_SCALE[grade.letterGrade as LetterGrade];
      weightedGpaSum += gpaPoints * credits;
      totalCreditHours += credits;
    }
  }
  const cumulativeGpa =
    totalCreditHours > 0
      ? (weightedGpaSum / totalCreditHours).toFixed(2)
      : "—";

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title={`Hello, ${session.firstName}`}
        description={`${student.programme.name} · ${student.studentNumber}`}
      />

      <div className="flex-1 px-6 py-6 space-y-6">

        {/* KPI row */}
        <StatCardGrid>
          <StatCard
            label="Current Courses"
            value={enrollments.length}
            icon={BookMarked}
            description="enrolled this semester"
            variant="default"
          />
          <StatCard
            label="Cumulative GPA"
            value={cumulativeGpa}
            icon={TrendingUp}
            description={`${totalCreditHours} credit hours`}
            variant={
              cumulativeGpa !== "—" && parseFloat(cumulativeGpa as string) >= 3.0
                ? "success"
                : cumulativeGpa !== "—" && parseFloat(cumulativeGpa as string) >= 2.0
                ? "warning"
                : "default"
            }
          />
          <StatCard
            label="Outstanding Balance"
            value={formatCurrency(outstandingBalance)}
            icon={Receipt}
            description={hasOverdueFees ? "has overdue fees" : "no overdue fees"}
            variant={outstandingBalance > 0 && hasOverdueFees ? "danger" : "success"}
          />
          <StatCard
            label="Published Grades"
            value={publishedGrades.length}
            icon={Award}
            description="courses graded"
            variant="default"
          />
        </StatCardGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Enrolled courses */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">My Courses</h2>
              <Link href="/my-courses" className="text-xs text-primary hover:underline font-medium">
                View all →
              </Link>
            </div>
            {enrollments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                Not enrolled in any courses yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {enrollments.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {e.courseOffering.course.code.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {e.courseOffering.course.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.courseOffering.course.code} ·{" "}
                        {e.courseOffering.course.creditHours} cr ·{" "}
                        {e.courseOffering.instructor
                          ? `${e.courseOffering.instructor.firstName} ${e.courseOffering.instructor.lastName}`
                          : "TBA"}
                      </p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--success))] flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent grades */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Grades</h2>
              <Link href="/my-grades" className="text-xs text-primary hover:underline font-medium">
                View all →
              </Link>
            </div>
            {publishedGrades.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground text-center">
                No published grades yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {publishedGrades.map((g) => {
                  const gradeColor =
                    g.letterGrade === "A_PLUS" || g.letterGrade === "A" || g.letterGrade === "A_MINUS"
                      ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                      : g.letterGrade === "F"
                      ? "bg-[hsl(var(--error-bg))] text-[hsl(var(--error))]"
                      : "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]";

                  const displayGrade = g.letterGrade
                    ?.replace("_PLUS", "+")
                    .replace("_MINUS", "-") ?? "—";

                  return (
                    <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${gradeColor}`}>
                        {displayGrade}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {g.courseOffering.course.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {g.courseOffering.course.code} · {formatDate(g.publishedAt)}
                        </p>
                      </div>
                      {g.numericScore && (
                        <span className="text-sm font-semibold text-foreground flex-shrink-0">
                          {toNumberRequired(g.numericScore).toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Fee summary */}
        {outstandingBalance > 0 && (
          <div className={`
            flex items-center gap-4 rounded-xl border px-5 py-4
            ${hasOverdueFees
              ? "border-destructive/30 bg-destructive/5"
              : "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning-bg))]"
            }
          `}>
            <AlertCircle className={`h-5 w-5 flex-shrink-0 ${
              hasOverdueFees ? "text-destructive" : "text-[hsl(var(--warning))]"
            }`} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {hasOverdueFees ? "Overdue fees" : "Outstanding balance"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have {formatCurrency(outstandingBalance)} outstanding.{" "}
                {hasOverdueFees ? "Some fees are past due." : ""}
              </p>
            </div>
            <a
              href="/my-fees"
              className="text-xs font-medium text-primary hover:underline flex-shrink-0"
            >
              View fees →
            </a>
          </div>
        )}

      </div>
    </div>
  );
}