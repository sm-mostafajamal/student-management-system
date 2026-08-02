"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { submitAssessmentSchema } from "@/lib/validations/assessment-submission";
import { submitAssessment, gradeSubmission } from "@/services/submission.service";
import { DomainError } from "@/lib/errors";
import { Role } from "@/types";
import type { ApiResult, SubmissionActionResult } from "@/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function submitAssessmentAction(
  _prevState: ApiResult<SubmissionActionResult> | null,
  formData: FormData
): Promise<ApiResult<SubmissionActionResult>> {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) {
    return { success: false, error: "Only students can submit assessments." };
  }

  const parsed = submitAssessmentSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid request." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      success: false,
      error: "Please choose a file to upload.",
      fieldErrors: { file: ["A file is required."] },
    };
  }

  // Cheap, early-exit size gate. The definitive check (magic bytes, exact
  // extension match) happens in the service layer.
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      success: false,
      error: "File exceeds the 10MB limit.",
      fieldErrors: { file: ["File exceeds the 10MB limit."] },
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await submitAssessment({
      assessmentId: parsed.data.assessmentId,
      studentId: user.studentId,
      fileBuffer: buffer,
      originalFileName: file.name,
    });

    revalidatePath(`/student/assessments/${parsed.data.assessmentId}`);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("submitAssessmentAction failed", err);
    return { success: false, error: "Something went wrong submitting your file." };
  }
}

export async function gradeSubmissionAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    return { success: false, error: "Only staff can grade submissions." };
  }

  const submissionId = formData.get("submissionId");
  const assessmentId = formData.get("assessmentId");
  const rawScore = formData.get("score");
  const rawFeedback = formData.get("feedback");

  if (typeof submissionId !== "string" || typeof assessmentId !== "string") {
    return { success: false, error: "Invalid request." };
  }

  const score = Number(rawScore);
  if (rawScore === null || rawScore === "" || Number.isNaN(score)) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { score: ["Enter a valid score."] },
    };
  }

  let courseOfferingId: string;

  try {
    const submission = await gradeSubmission(
      {
        submissionId,
        score,
        feedback:
          typeof rawFeedback === "string" && rawFeedback.trim() !== ""
            ? rawFeedback.trim()
            : undefined,
      },
      user
    );

    revalidatePath(`/assessments/${assessmentId}/submissions`);
    revalidatePath(`/assessments/${assessmentId}/submissions/${submissionId}/grade`);
    revalidatePath(`/assessments/${assessmentId}/submissions/${submissionId}/history`);

    courseOfferingId = submission.courseOfferingId;
    revalidatePath(`/course-offerings/${courseOfferingId}/marksheet`);
  } catch (err) {
    if (err instanceof DomainError) {
      return { success: false, error: err.message };
    }
    console.error("gradeSubmissionAction failed", err);
    return { success: false, error: "Something went wrong grading this submission." };
  }

  // Must be outside the try/catch — redirect() throws internally and
  // would otherwise be caught and reported as a generic failure.
  redirect(`/course-offerings/${courseOfferingId}/marksheet`);
}