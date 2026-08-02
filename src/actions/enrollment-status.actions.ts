"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { changeStudentStatusSchema } from "@/lib/validations/enrollment-status.schema";
import { changeStudentStatus, type ChangeStatusResult } from "@/services/enrollment-status.service";
import type { ApiResult } from "@/types";

async function assertStaff() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") {
    throw new AppError("FORBIDDEN", "Only staff can change enrollment status.");
  }
  return user;
}

export async function changeStudentStatusAction(
  studentId: string,
  input: unknown
): Promise<ApiResult<ChangeStatusResult>> {
  try {
    const staff = await assertStaff();

    const parsed = changeStudentStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const result = await changeStudentStatus(studentId, parsed.data, staff.id);

    revalidatePath("/students");
    revalidatePath(`/students/${studentId}/edit`);
    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (err) {
    if (err instanceof AppError) {
      return { success: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    console.error("[enrollment-status.actions] unexpected error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}