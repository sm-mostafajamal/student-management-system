// Manages FeeStructure — the TEMPLATE for what a programme costs per
// year/semester/category. This is NOT what a student owes; see fee.service.ts
// for the per-student Fee (the actual invoice).

import { prisma } from "@/lib/prisma";
import type { Semester, FeeCategory } from "@/types";

export class FeeStructureError extends Error {}

interface CreateFeeStructureInput {
  programmeId: string;
  academicYearId: string;
  semester: Semester;
  category: FeeCategory;
  amount: number;
}

export async function createFeeStructure(input: CreateFeeStructureInput) {
  const existing = await prisma.feeStructure.findUnique({
    where: {
      programmeId_academicYearId_semester_category: {
        programmeId: input.programmeId,
        academicYearId: input.academicYearId,
        semester: input.semester,
        category: input.category,
      },
    },
  });

  if (existing) {
    if (existing.isActive) {
      throw new FeeStructureError(
        `An active ${input.category} fee structure already exists for this programme/year/semester. Edit it instead of creating a duplicate.`
      );
    }
    // A previously deactivated structure for this exact combination — reactivate
    // and refresh the amount rather than creating a second, conflicting row.
    return prisma.feeStructure.update({
      where: { id: existing.id },
      data: { amount: input.amount, isActive: true },
    });
  }

  return prisma.feeStructure.create({ data: input });
}

export async function listFeeStructures(filters: {
  programmeId?: string;
  academicYearId?: string;
  isActive?: boolean;
}) {
  return prisma.feeStructure.findMany({
    where: filters,
    include: { programme: true, academicYear: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates the TEMPLATE amount only.
 *
 * Deliberately does NOT touch any Fee rows already issued from this
 * structure — Fee.amountDue is a point-in-time snapshot taken when the
 * student was billed (see Fee model comment in schema.prisma). This is the
 * direct answer to "what happens if the programme fee changes after a
 * student is enrolled": nothing happens to students already billed. Only
 * the NEXT call to assignFeesForStudent() picks up the new amount.
 *
 * If Registry genuinely needs to re-bill already-enrolled students at the
 * new rate (rare — usually a policy decision, not a data fix), that's a
 * deliberate separate action, not an automatic side effect of this one.
 */
export async function updateFeeStructureAmount(id: string, amount: number) {
  return prisma.feeStructure.update({ where: { id }, data: { amount } });
}

export async function deactivateFeeStructure(id: string) {
  return prisma.feeStructure.update({ where: { id }, data: { isActive: false } });
}

export async function reactivateFeeStructure(id: string) {
  return prisma.feeStructure.update({ where: { id }, data: { isActive: true } });
}