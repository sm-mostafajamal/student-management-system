"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import {
  recordGradeSchema,
  publishResultSchema,
  unpublishResultSchema,
} from "@/lib/validations/result";
import { recordGrade, publishResult, unpublishResult } from "@/services/result.service";
import { DomainError } from "@/lib/errors";
import type { ApiResult } from "@/types";
import { computeGradeSchema } from "@/lib/validations/result"; 
import { computeAndRecordGrade } from "@/services/result.service"; 

export async function recordGradeAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = recordGradeSchema.safeParse({
    studentId: formData.get("studentId"),
    courseOfferingId: formData.get("courseOfferingId"),
    numericScore: formData.get("numericScore"),
    reason: formData.get("reason") || undefined,
    expectedVersion: formData.get("expectedVersion") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const grade = await recordGrade(parsed.data, user);
    revalidatePath(`/course-offerings/${parsed.data.courseOfferingId}/marksheet`);
    return { success: true, data: { id: grade.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("recordGradeAction failed", err);
    return { success: false, error: "Something went wrong recording the grade." };
  }
}

export async function publishResultAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = publishResultSchema.safeParse({
    gradeId: formData.get("gradeId"),
    expectedVersion: formData.get("expectedVersion"),
  });
  if (!parsed.success) return { success: false, error: "Invalid request." };

  try {
    const grade = await publishResult(parsed.data, user);
    revalidatePath(`/course-offerings/${grade.courseOfferingId}/marksheet`);
    revalidatePath("/results");
    return { success: true, data: { id: grade.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("publishResultAction failed", err);
    return { success: false, error: "Something went wrong publishing the result." };
  }
}

export async function unpublishResultAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = unpublishResultSchema.safeParse({
    gradeId: formData.get("gradeId"),
    expectedVersion: formData.get("expectedVersion"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Please provide a reason.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const grade = await unpublishResult(parsed.data, user);
    revalidatePath(`/course-offerings/${grade.courseOfferingId}/marksheet`);
    revalidatePath("/results");
    return { success: true, data: { id: grade.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("unpublishResultAction failed", err);
    return { success: false, error: "Something went wrong withholding the result." };
  }
}


export async function computeAndSaveGradeAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = computeGradeSchema.safeParse({
    studentId: formData.get("studentId"),
    courseOfferingId: formData.get("courseOfferingId"),
    reason: formData.get("reason") || undefined,
    expectedVersion: formData.get("expectedVersion") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const grade = await computeAndRecordGrade(parsed.data, user);
    revalidatePath(`/course-offerings/${parsed.data.courseOfferingId}/marksheet`);
    return { success: true, data: { id: grade.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("computeAndSaveGradeAction failed", err);
    return { success: false, error: "Something went wrong computing the grade." };
  }
}