import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { listOverdueFees } from "@/services/fee.service";

export default async function FeesOverviewPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") redirect("/");

  const overdue = await listOverdueFees();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fees &amp; Payments</h1>
        <Link
          href="/fees/structures"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          Manage fee structures
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Overdue students ({overdue.length})
        </h2>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No overdue fees. Registry is all caught up.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Due date</th>
                  <th className="px-4 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {overdue.map((row) => (
                  <tr key={row.feeId} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2">
                      <Link
                        href={`/fees/students/${row.studentId}`}
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {row.firstName} {row.lastName}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{row.studentNumber}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{row.category.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                      {new Date(row.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600 dark:text-red-400">
                      {Number(row.balance).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}