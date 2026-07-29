// ─────────────────────────────────────────────
// ADDED FOR /payments STAFF LEDGER — read-only, no business logic.
// Matches this file's existing conventions: throws plain/custom Errors,
// returns raw shapes (no ApiResult wrapper) — NOT fee.service.ts's style.
// ─────────────────────────────────────────────

export interface ListPaymentsFilters {
  studentId?: string;
  method?: PaymentMethod;
  status?: "COMPLETED" | "FAILED" | "REVERSED";
  dateFrom?: Date;
  dateTo?: Date;
  /** Matches student name or studentNumber, case-insensitive. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentLedgerRow {
  id: string;
  reference: string;
  amount: number;
  method: PaymentMethod;
  status: "COMPLETED" | "FAILED" | "REVERSED";
  paidAt: Date;
  studentId: string;
  studentNumber: string;
  studentName: string;
  feeCategory: string;
  recordedByName: string;
  reversedByName: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
}

export async function listPayments(
  filters: ListPaymentsFilters
): Promise<{ items: PaymentLedgerRow[]; total: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.PaymentWhereInput = {
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          paidAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          student: {
            OR: [
              { studentNumber: { contains: filters.search, mode: "insensitive" } },
              { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
              { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        student: { include: { user: true } },
        fee: { select: { category: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
        reversedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where }),
  ]);

  const items: PaymentLedgerRow[] = rows.map((p) => ({
    id: p.id,
    reference: p.reference,
    amount: Number(p.amount),
    method: p.method,
    status: p.status as "COMPLETED" | "FAILED" | "REVERSED",
    paidAt: p.paidAt,
    studentId: p.studentId,
    studentNumber: p.student.studentNumber,
    studentName: `${p.student.user.firstName} ${p.student.user.lastName}`,
    feeCategory: p.fee.category,
    recordedByName: `${p.recordedBy.firstName} ${p.recordedBy.lastName}`,
    reversedByName: p.reversedBy ? `${p.reversedBy.firstName} ${p.reversedBy.lastName}` : null,
    reversedAt: p.reversedAt,
    reversalReason: p.reversalReason,
  }));

  return { items, total };
}