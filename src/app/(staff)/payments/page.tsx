import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { listPayments } from "@/services/payment.service";
import { getOutstandingFeesSummary, listOutstandingFees } from "@/services/fee.service";
import { PaymentFilters } from "./payment-filters";
import { ReversePaymentControl } from "./reverse-payment-row";
import type { PaymentMethod } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    method?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 25;

export default async function PaymentsLedgerPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");
  
  const params = await searchParams; 
  const page = Number(params.page ?? "1") || 1;

  const [{ items, total }, outstanding, outstandingRows] = await Promise.all([
    listPayments({
      search: params.search,
      method: params.method as PaymentMethod | undefined,
      status: params.status as "COMPLETED" | "FAILED" | "REVERSED" | undefined,
      dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
      dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    // listPayments() only ever queries the Payment table (money already
    // recorded) — it has no visibility into unpaid Fee balances. Pull
    // that separately so this ledger can also surface what's still owed.
    getOutstandingFeesSummary(),
    listOutstandingFees(10),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          All recorded payments. Reversing never deletes the record — it flips status to
          REVERSED with a reason, same as the grade audit trail.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total outstanding
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {outstanding.totalOutstanding.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across {outstanding.feeCount} unpaid or partially-paid fee
            {outstanding.feeCount === 1 ? "" : "s"} — not limited to overdue.
          </p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recorded on this page
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total matching payment transactions (all statuses).
          </p>
        </div>
      </div>

      <PaymentFilters selected={params} />

      {outstandingRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Outstanding balances (top {outstandingRows.length})
          </h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 font-medium">Student</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium">Due date</th>
                  <th className="p-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {outstandingRows.map((row) => (
                  <tr key={row.feeId} className="border-t">
                    <td className="p-3">
                      <Link
                        href={`/fees/students/${row.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {row.firstName} {row.lastName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.studentNumber}</div>
                    </td>
                    <td className="p-3">{row.category.replace(/_/g, " ")}</td>
                    <td className="p-3">
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums text-destructive">
                      {Number(row.balance).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Paid</th>
                <th className="p-3 font-medium">Recorded by</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{p.reference}</td>
                  <td className="p-3">
                    <Link
                      href={`/fees/students/${p.studentId}`}
                      className="font-medium hover:underline"
                    >
                      {p.studentName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.studentNumber}</div>
                  </td>
                  <td className="p-3">{p.feeCategory.replace(/_/g, " ")}</td>
                  <td className="p-3 tabular-nums">{p.amount.toFixed(2)}</td>
                  <td className="p-3">{p.method.replace(/_/g, " ")}</td>
                  <td className="p-3">
                    <span
                      className={
                        p.status === "COMPLETED"
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          : p.status === "REVERSED"
                            ? "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3">{p.paidAt.toLocaleDateString()}</td>
                  <td className="p-3">{p.recordedByName}</td>
                  <td className="p-3">
                    <ReversePaymentControl payment={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

       {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/payments?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                className="rounded-md border px-3 py-1 hover:bg-accent"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/payments?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                className="rounded-md border px-3 py-1 hover:bg-accent"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}