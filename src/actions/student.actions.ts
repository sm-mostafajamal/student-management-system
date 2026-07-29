"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { AppError } from "@/lib/errors";
import {
  createStudentSchema,
  updateStudentSchema,
  type CreateStudentInput,
  type UpdateStudentInput,
} from "@/lib/validations/student.schema";
import * as studentService from "@/services/student.service";
import type { ApiResult, StudentWithProgramme } from "@/types";

async function assertStaff() {
  const user = await getSessionUser();
  if (!user || user.role !== "STAFF") {
    throw new AppError("FORBIDDEN", "Only staff can perform this action.");
  }
  return user;
}

function toApiResult<T>(err: unknown): ApiResult<T> {
  if (err instanceof AppError) {
    return { success: false, error: err.message, fieldErrors: err.fieldErrors };
  }
  console.error("[student.actions] unexpected error:", err);
  return { success: false, error: "Something went wrong. Please try again." };
}

export async function createStudentAction(
  input: CreateStudentInput
): Promise<ApiResult<StudentWithProgramme>> {
  try {
    await assertStaff();
    const parsed = createStudentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const student = await studentService.createStudent(parsed.data);
    revalidatePath("/students");
    return { success: true, data: student };
  } catch (err) {
    return toApiResult(err);
  }
}

export async function updateStudentAction(
  id: string,
  input: UpdateStudentInput
): Promise<ApiResult<StudentWithProgramme>> {
  try {
    await assertStaff();
    const parsed = updateStudentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const student = await studentService.updateStudent(id, parsed.data);
    revalidatePath("/students");
    revalidatePath(`/students/${id}/edit`);
    return { success: true, data: student };
  } catch (err) {
    return toApiResult(err);
  }
}

export async function deleteStudentAction(id: string): Promise<ApiResult<null>> {
  try {
    await assertStaff();
    await studentService.softDeleteStudent(id);
    revalidatePath("/students");
    return { success: true, data: null };
  } catch (err) {
    return toApiResult(err);
  }
}