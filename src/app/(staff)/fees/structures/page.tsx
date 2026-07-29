import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listFeeStructures } from "@/services/fee-structure.service";
import { FeeStructureForm } from "@/components/fees/fee-structure-form";

export default async function FeeStructuresPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") redirect("/");

  const [structures, programmes, academicYears] = await Promise.all([
    listFeeStructures({}),
    prisma.programme.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fee Structures</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <FeeStructureForm programmes={programmes} academicYears={academicYears} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="px-4 py-2 font-medium">Programme</th>
              <th className="px-4 py-2 font-medium">Year</th>
              <th className="px-4 py-2 font-medium">Semester</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {structures.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.programme.name}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.academicYear.name}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.semester.replace("_", " ")}</td>
                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{s.category.replace("_", " ")}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{Number(s.amount).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span className={s.isActive ? "text-green-700 dark:text-green-400" : "text-gray-400"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}