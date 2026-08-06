import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getStudentFeeBreakdown } from "@/services/fee.service";
import { RecordPaymentForm } from "@/components/fees/record-payment-form";
import { ReversePaymentButton } from "@/components/fees/reverse-payment-button";
import { formatDate } from "@/lib/utils";
import type { StudentWithProgramme } from "@/types";

export const dynamic = "force-dynamic";

export default async function StudentFeesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") redirect("/");

  const { studentId } = await params;
  const result = await getStudentFeeBreakdown(studentId);

  if (!result.success) notFound();
  const {
    student,
    programme,
    baseFee,
    programmeFeeLine,
    courseFeeLines,
    otherFeeLines,
    enrolledCourses,
    totalOwed,
    totalWaived,
    totalPaid,
    outstandingBalance,
  } = result.data;

  const creditBalance = outstandingBalance < 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {student?.user?.firstName} {student?.user?.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {student.studentNumber} ·{" "}
            <span className="font-medium text-foreground">{programme.name}</span>
            {baseFee > 0 && (
              <span className="ml-2 text-muted-foreground">
                (base fee:{" "}
                {baseFee.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                )
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total billed"
          value={totalOwed}
          tone="neutral"
        />
        <SummaryCard
          label={totalWaived > 0 ? `Paid (${totalWaived.toLocaleString()} waived)` : "Total paid"}
          value={totalPaid}
          tone="positive"
        />
        <SummaryCard
          label={creditBalance ? "Credit (overpaid)" : "Outstanding balance"}
          value={Math.abs(outstandingBalance)}
          tone={
            creditBalance
              ? "positive"
              : outstandingBalance > 0
              ? "warning"
              : "positive"
          }
          prefix={creditBalance ? "−" : undefined}
        />
      </div>

      {/* ── Enrolled courses (full course load, regardless of billing) ─ */}
      {enrolledCourses.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            Current Course Enrolments
          </h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium text-muted-foreground">Course</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Credits</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Course Fee</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Paid</th>
                  <th className="p-3 text-right font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrolledCourses.map(({ enrollment, course, feeLine }) => (
                  <tr key={enrollment.id}>
                    <td className="p-3">
                      <p className="font-medium text-foreground">{course.title}</p>
                      <p className="text-xs text-muted-foreground">{course.code}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">{course.creditHours}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {feeLine
                        ? feeLine.amountDue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {feeLine
                        ? feeLine.totalPaid.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {feeLine ? (
                        <span
                          className={
                            feeLine.balance < 0
                              ? "text-green-700 dark:text-green-400 font-medium"
                              : feeLine.balance > 0
                              ? feeLine.isOverdue
                                ? "text-red-600 dark:text-red-400 font-semibold"
                                : "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-green-700 dark:text-green-400"
                          }
                        >
                          {feeLine.balance < 0 ? "Credit" : feeLine.balance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {feeLine.isOverdue && (
                            <span className="ml-1 text-xs font-semibold uppercase tracking-wider">
                              {" "}Overdue
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No fee</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Fee line items with payment forms ──────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Fee Breakdown & Payments</h2>

        {/* Programme base fee */}
        {programmeFeeLine && (
          <FeeCard
            label={`Programme Fee — ${programme.name}`}
            feeLine={programmeFeeLine}
            student={student}
          />
        )}

        {/* Per-course fees */}
        {courseFeeLines.map((line) => (
          <FeeCard
            key={line.fee.id}
            label={
              line.course
                ? `Course Fee — ${line.course.title} (${line.course.code})`
                : "Course Fee"
            }
            feeLine={line}
            student={student}
          />
        ))}

        {/* Legacy / manual / FeeStructure-sourced fees */}
        {otherFeeLines.map((line) => (
          <FeeCard
            key={line.fee.id}
            label={`${line.fee.category.replace(/_/g, " ")} — ${line.fee.semester.replace(/_/g, " ")}`}
            feeLine={line}
            student={student}
          />
        ))}

        {programmeFeeLine === null &&
          courseFeeLines.length === 0 &&
          otherFeeLines.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No fees have been assigned to this student yet.
            </p>
          )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FeeLine {
  fee: {
    id: string;
    dueDate: Date | null;
    payments: Array<{
      id: string;
      paidAt: Date;
      reference: string;
      method: string;
      amount: unknown;
      status: string;
    }>;
  };
  amountDue: number;
  waivedAmount: number;
  totalPaid: number;
  balance: number;
  isOverdue: boolean;
}

function FeeCard({
  label,
  feeLine,
  student,
}: {
  label: string;
  feeLine: FeeLine;
  student: StudentWithProgramme;
}) {
  const { fee, amountDue, waivedAmount, totalPaid, balance, isOverdue } = feeLine;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Fee header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fee.dueDate ? `Due ${formatDate(fee.dueDate)}` : "No due date"}
            {waivedAmount > 0 && (
              <span className="ml-2 text-green-700 dark:text-green-400">
                · {waivedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                waived
              </span>
            )}
          </p>
        </div>
        <div className="text-right flex-shrink-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {amountDue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            billed
            {totalPaid > 0 && (
              <span className="ml-1">
                · {totalPaid.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                paid
              </span>
            )}
          </p>
          <p
            className={`text-lg font-semibold ${
              balance < 0
                ? "text-green-700 dark:text-green-400"
                : isOverdue
                ? "text-red-600 dark:text-red-400"
                : balance > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-green-700 dark:text-green-400"
            }`}
          >
            {balance < 0
              ? `Credit ${Math.abs(balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </p>
          {isOverdue && (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Record payment form (hidden when fully settled) */}
      <div className="border-t border-border pt-3">
        <RecordPaymentForm feeId={fee.id} studentId={student.id} balance={balance} />
      </div>

      {/* Payment history */}
      {fee.payments.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Payment history</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-normal text-xs">Date</th>
                <th className="py-1 font-normal text-xs">Reference</th>
                <th className="py-1 font-normal text-xs">Method</th>
                <th className="py-1 text-right font-normal text-xs">Amount</th>
                <th className="py-1 text-right font-normal text-xs">Status</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {fee.payments.map((p) => (
                <tr key={p.id} className="border-t border-border/50">
                  <td className="py-1.5 text-muted-foreground text-xs">
                    {p.paidAt instanceof Date
                      ? p.paidAt.toLocaleDateString()
                      : new Date(p.paidAt).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 font-mono text-xs text-muted-foreground">{p.reference}</td>
                  <td className="py-1.5 text-muted-foreground text-xs">
                    {p.method.replace(/_/g, " ")}
                  </td>
                  <td className="py-1.5 text-right text-foreground text-xs">
                    {Number(p.amount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-1.5 text-right text-xs">
                    <span
                      className={
                        p.status === "REVERSED"
                          ? "text-red-600 dark:text-red-400"
                          : p.status === "COMPLETED"
                          ? "text-green-700 dark:text-green-400"
                          : "text-muted-foreground"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {p.status === "COMPLETED" && (
                      <ReversePaymentButton paymentId={p.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
  prefix,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "warning" | "danger";
  prefix?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-green-700 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>
        {prefix}
        {value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}