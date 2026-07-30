"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  createFeeStructure,
  listFeeStructures,
  updateFeeStructureAmount,
  deactivateFeeStructure,
} from "@/services/fee-structure.service";
import {
  assignFeesForStudent,
  bulkAssignFeesForProgramme,
  computeFeeBalance,
  getStudentFinancialSummary,
  listOverdueFees,
} from "@/services/fee.service";
import {
  createFeeStructureSchema,
  updateFeeStructureAmountSchema,
  assignFeesSchema,
  bulkAssignFeesSchema,
} from "@/lib/validations/fee.schema";
import type { ApiResult } from "@/types";

async function assertStaff() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") {
    throw new AppError("FORBIDDEN", "This action is restricted to Registry staff.");
  }
  return user;
}

function toApiResult<T>(err: unknown): ApiResult<T> {
  if (err instanceof AppError) {
    return { success: false, error: err.message, fieldErrors: err.fieldErrors };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  console.error("[fee.actions] unexpected error:", err);
  return { success: false, error: "Something went wrong. Please try again." };
}

export async function createFeeStructureAction(
  input: unknown
): Promise<ApiResult<{ id: string }>> {
  try {
    await assertStaff();
    const parsed = createFeeStructureSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const structure = await createFeeStructure(parsed.data);
    revalidatePath("/fees/structures");
    return { success: true, data: { id: structure.id } };
  } catch (err) {
    return toApiResult(err);
  }
}

export async function updateFeeStructureAmountAction(
  input: unknown
): Promise<ApiResult<{ id: string }>> {
  try {
    await assertStaff();
    const parsed = updateFeeStructureAmountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const structure = await updateFeeStructureAmount(parsed.data.id, parsed.data.amount);
    revalidatePath("/fees/structures");
    return { success: true, data: { id: structure.id } };
  } catch (err) {
    return toApiResult(err);
  }
}

export async function deactivateFeeStructureAction(id: string): Promise<ApiResult<{ id: string }>> {
  try {
    await assertStaff();
    const structure = await deactivateFeeStructure(id);
    revalidatePath("/fees/structures");
    return { success: true, data: { id: structure.id } };
  } catch (err) {
    return toApiResult(err);
  }
}

export async function assignFeesToStudentAction(
  input: unknown
): Promise<ApiResult<{ created: number; skipped: string[] }>> {
  try {
    await assertStaff();
    const parsed = assignFeesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const result = await assignFeesForStudent(
      parsed.data.studentId,
      parsed.data.academicYearId,
      parsed.data.semester
    );
    revalidatePath(`/fees/students/${parsed.data.studentId}`);
    revalidatePath("/fees");
    return { success: true, data: result };
  } catch (err) {
    return toApiResult(err);
  }
}

interface BulkAssignResult {
  totalStudents: number;
  succeeded: number;
  failed: { studentId: string; reason: string }[];
}

export async function bulkAssignFeesAction(input: unknown): Promise<ApiResult<BulkAssignResult>> {
  try {
    await assertStaff();
    const parsed = bulkAssignFeesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    const result = await bulkAssignFeesForProgramme(
      parsed.data.programmeId,
      parsed.data.academicYearId,
      parsed.data.semester
    );
    revalidatePath("/fees");
    return { success: true, data: result };
  } catch (err) {
    return toApiResult(err);
  }
}

interface StudentFeesResult {
  fees: Awaited<ReturnType<typeof computeFeeBalance>>[];
  summary: Awaited<ReturnType<typeof getStudentFinancialSummary>>;
}

/** Staff can view any student; a STUDENT session can only view their own record. */
export async function getStudentFeesAction(studentId: string): Promise<ApiResult<StudentFeesResult>> {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "You must be signed in to view fee records.");
    }
    if (user.role === "STUDENT" && user.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "You may only view your own fee records.");
    }
    const feeRows = await prisma.fee.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    const fees = await Promise.all(feeRows.map((f) => computeFeeBalance(f.id)));
    const summary = await getStudentFinancialSummary(studentId);
    return { success: true, data: { fees, summary } };
  } catch (err) {
    return toApiResult(err);
  }
}

interface OverdueFeeRow {
  feeId: string;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  category: string;
  dueDate: Date;
  amountDue: number;
  waivedAmount: number;
  totalPaid: number;
  balance: number;
}

export async function getOverdueFeesAction(): Promise<ApiResult<OverdueFeeRow[]>> {
  try {
    await assertStaff();
    const rows = await listOverdueFees();
    const serialized: OverdueFeeRow[] = rows.map((r) => ({
      ...r,
      amountDue: Number(r.amountDue),
      waivedAmount: Number(r.waivedAmount),
      totalPaid: Number(r.totalPaid),
      balance: Number(r.balance),
    }));
    return { success: true, data: serialized };
  } catch (err) {
    return toApiResult(err);
  }
}