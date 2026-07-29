"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { createAssessmentSchema } from "@/lib/validations/assessment-submission";
import { createAssessment } from "@/services/assessment.service";
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
    revalidatePath(`/staff/course-offerings/${parsed.data.courseOfferingId}/assessments`);
    return { success: true, data: { id: assessment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("createAssessmentAction failed", err);
    return { success: false, error: "Something went wrong creating the assessment." };
  }
}