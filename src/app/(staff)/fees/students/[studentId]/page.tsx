import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeFeeBalance, getStudentFinancialSummary } from "@/services/fee.service";
import { RecordPaymentForm } from "@/components/fees/record-payment-form";
import { ReversePaymentButton } from "@/components/fees/reverse-payment-button";
import { AssignFeesButton } from "@/components/fees/assign-fees-button";

export default async function StudentFeesPage({ params }: { params: Promise<{ studentId: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") redirect("/");

  const { studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { id: studentId, deletedAt: null },
    include: { user: true, programme: true },
  });
  if (!student) notFound();

  const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });

  const fees = await prisma.fee.findMany({
    where: { studentId: student.id },
    include: { payments: { orderBy: { paidAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const balanceResults = await Promise.all(fees.map((f) => computeFeeBalance(f.id)));
  const balances = balanceResults.map((r) => {
    if (!r.success) throw new Error(r.error);
    return r.data;
  });
  const result = await getStudentFinancialSummary(student.id);
  const summary = result.success && result.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {student.user.firstName} {student.user.lastName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {student.studentNumber} · {student.programme.name}
          </p>
        </div>
        <AssignFeesButton studentId={student.id} academicYearId={currentYear?.id} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary &&
          <div>

            <SummaryCard label="Total billed" value={summary.totalOwed} />
            <SummaryCard label="Total paid" value={summary.totalPaid} tone="positive" />
            <SummaryCard
              label="Outstanding balance"
              value={summary.outstandingBalance}
              tone={summary.hasOverdueFees ? "danger" : summary.outstandingBalance > 0 ? "warning" : "positive"}
            />
          </div>
        }
      </div>

      <div className="space-y-4">
        {fees.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No fees have been assigned to this student yet.</p>
        )}
        {fees.map((fee, i) => {
          const balance = balances[i];
          return (
            <div
              key={fee.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {fee.category.replace("_", " ")} — {fee.semester.replace("_", " ")}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Due: {fee.dueDate ? fee.dueDate.toLocaleDateString() : "No due date"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
                  <p
                    className={`text-lg font-semibold ${balance.isOverdue
                        ? "text-red-600 dark:text-red-400"
                        : balance.balance > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-green-700 dark:text-green-400"
                      }`}
                  >
                    {balance.balance.toFixed(2)}
                  </p>
                  {balance.isOverdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      Overdue
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                <RecordPaymentForm feeId={fee.id} balance={balance.balance} />
              </div>

              {fee.payments.length > 0 && (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-1 font-normal">Date</th>
                      <th className="py-1 font-normal">Reference</th>
                      <th className="py-1 font-normal">Method</th>
                      <th className="py-1 text-right font-normal">Amount</th>
                      <th className="py-1 text-right font-normal">Status</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fee.payments.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-1 text-gray-700 dark:text-gray-300">{p.paidAt.toLocaleDateString()}</td>
                        <td className="py-1 text-gray-700 dark:text-gray-300">{p.reference}</td>
                        <td className="py-1 text-gray-700 dark:text-gray-300">{p.method.replace("_", " ")}</td>
                        <td className="py-1 text-right text-gray-900 dark:text-gray-100">
                          {Number(p.amount).toFixed(2)}
                        </td>
                        <td className="py-1 text-right">
                          <span
                            className={
                              p.status === "REVERSED"
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-700 dark:text-green-400"
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-1 text-right">{p.status === "COMPLETED" && <ReversePaymentButton paymentId={p.id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-gray-900 dark:text-gray-100",
    positive: "text-green-700 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value.toFixed(2)}</p>
    </div>
  );
}