import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { listPayments } from "@/services/payment.service";
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

  const { items, total } = await listPayments({
    search: params.search,
    method: params.method as PaymentMethod | undefined,
    status: params.status as "COMPLETED" | "FAILED" | "REVERSED" | undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

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

      <PaymentFilters selected={params} />

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