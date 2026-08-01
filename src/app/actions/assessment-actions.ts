"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { createAssessmentSchema, updateAssessmentSchema } from "@/lib/validations/assessment-submission";
import { createAssessment, updateAssessment, deactivateAssessment } from "@/services/assessment.service";
import { DomainError } from "@/lib/errors";
import type { ApiResult } from "@/types";

export async function createAssessmentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const parsed = createAssessmentSchema.safeParse({
    courseOfferingId: formData.get("courseOfferingId"),
    title: formData.get("title"),
    type: formData.get("type"),
    weightPercentage: formData.get("weightPercentage"),
    maxScore: formData.get("maxScore"),
    dueDate: formData.get("dueDate"),
    gracePeriodMinutes: formData.get("gracePeriodMinutes") || undefined,
    maxAttempts: formData.get("maxAttempts") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const assessment = await createAssessment(parsed.data, user);
    revalidatePath(`/course-offerings/${parsed.data.courseOfferingId}`);
    revalidatePath("/assessments");
    return { success: true, data: { id: assessment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("createAssessmentAction failed", err);
    return { success: false, error: "Something went wrong creating the assessment." };
  }
}

export async function updateAssessmentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const assessmentId = formData.get("assessmentId");
  if (typeof assessmentId !== "string" || !assessmentId) {
    return { success: false, error: "Missing assessment id." };
  }

  // Only pass fields that were actually present in the form, so unfilled
  // optional inputs don't get coerced into e.g. weightPercentage: 0.
  const raw: Record<string, FormDataEntryValue> = {};
  for (const key of [
    "title",
    "type",
    "weightPercentage",
    "maxScore",
    "dueDate",
    "gracePeriodMinutes",
    "maxAttempts",
  ]) {
    const value = formData.get(key);
    if (value !== null && value !== "") raw[key] = value;
  }

  const parsed = updateAssessmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const assessment = await updateAssessment(assessmentId, parsed.data, user);
    revalidatePath(`/assessments/${assessmentId}/edit`);
    revalidatePath(`/assessments/${assessmentId}/submissions`);
    revalidatePath(`/course-offerings/${assessment.courseOfferingId}/marksheet`);
    revalidatePath("/assessments");
    revalidatePath(`/assessments/${assessmentId}/marksheet`);
    return { success: true, data: { id: assessment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("updateAssessmentAction failed", err);
    return { success: false, error: "Something went wrong updating the assessment." };
  }
}

export async function deactivateAssessmentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Not authenticated." };
  }

  const assessmentId = formData.get("assessmentId");
  if (typeof assessmentId !== "string" || !assessmentId) {
    return { success: false, error: "Missing assessment id." };
  }

  try {
    const assessment = await deactivateAssessment(assessmentId, user);
    revalidatePath(`/course-offerings/${assessment.courseOfferingId}/marksheet`);
    revalidatePath("/assessments");
    revalidatePath(`/assessments/${assessmentId}/marksheet`);
    return { success: true, data: { id: assessment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("deactivateAssessmentAction failed", err);
    return { success: false, error: "Something went wrong deactivating the assessment." };
  }
}