import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listFeeStructures } from "@/services/fee-structure.service";
import { FeeStructureForm } from "@/components/fees/fee-structure-form";
import { FeeStructureRowActions } from "@/components/fees/fee-structure-row-actions";

interface PageProps {
  searchParams: Promise<{
    programmeId?: string;
    academicYearId?: string;
    status?: string; // "active" | "inactive" | undefined (= all)
  }>;
}

export default async function FeeStructuresPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") redirect("/");

  const { programmeId, academicYearId, status } = await searchParams;

  const [structures, programmes, academicYears] = await Promise.all([
    listFeeStructures({
      ...(programmeId ? { programmeId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
    }),
    prisma.programme.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fee Structures</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <FeeStructureForm programmes={programmes} academicYears={academicYears} />
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Programme
          </label>
          <select
            name="programmeId"
            defaultValue={programmeId ?? ""}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">All programmes</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Academic Year
          </label>
          <select
            name="academicYearId"
            defaultValue={academicYearId ?? ""}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">All years</option>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Status
          </label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          Filter
        </button>
        {(programmeId || academicYearId || status) && (
          <Link
            href="/fees/structures"
            className="text-sm text-gray-500 hover:underline dark:text-gray-400"
          >
            Clear filters
          </Link>
        )}
      </form>

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
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {structures.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No fee structures match these filters.
                </td>
              </tr>
            ) : (
              structures.map((s) => (
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
                  <td className="px-4 py-2 text-right">
                    <FeeStructureRowActions id={s.id} amount={Number(s.amount)} isActive={s.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}