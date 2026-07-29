import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeFeeBalance, getStudentFinancialSummary } from "@/services/fee.service";

export default async function MyFeesPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "STUDENT" || !user.studentId) redirect("/");

  const fees = await prisma.fee.findMany({
    where: { studentId: user.studentId },
    orderBy: { createdAt: "desc" },
  });
  const balances = await Promise.all(fees.map((f) => computeFeeBalance(f.id)));
  const summary = await getStudentFinancialSummary(user.studentId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Fees</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total billed</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{(summary?.totalOwed ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total paid</p>
          <p className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-400">{(summary?.totalPaid ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding balance</p>
          <p
            className={`mt-1 text-2xl font-semibold ${summary.hasOverdueFees ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              }`}
          >
            {(summary?.outstandingBalance ?? 0) .toFixed(2)}
          </p>
        </div>
      </div>

      {summary.hasOverdueFees && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          You have one or more overdue fees. Please clear your balance at the Registry office.
        </div>
      )}

      <div className="space-y-3">
        {fees.map((fee, i) => {
          const balance = balances[i];
          return (
            <div
              key={fee.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{fee.category.replace("_", " ")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {fee.semester.replace("_", " ")} · Due{" "}
                    {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "N/A"}
                  </p>
                </div>
                <p
                  className={`text-lg font-semibold ${balance.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                    }`}
                >
                  {(balance?.balance ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}