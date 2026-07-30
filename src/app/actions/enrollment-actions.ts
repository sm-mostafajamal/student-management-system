"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { enrollStudentSchema, dropEnrollmentSchema } from "@/lib/validations/enrollment";
import { enrollStudent, dropEnrollment } from "@/services/enrollment.service";
import { DomainError } from "@/lib/errors";
import type { ApiResult } from "@/types";

export async function enrollStudentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = enrollStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    courseOfferingId: formData.get("courseOfferingId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // Business rules (capacity, duplicate enrollment, WITHDRAWN/SUSPENDED student
    // status) all live in enrollStudent() itself — we don't re-check any of it here.
    const enrollment = await enrollStudent(
      { studentId: parsed.data.studentId, courseOfferingId: parsed.data.courseOfferingId },
      user
    );
    revalidatePath(`/enrollments/${parsed.data.courseOfferingId}`);
    return { success: true, data: { id: enrollment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      // Surfaces the service's own message verbatim, e.g.:
      // "This course offering is at full capacity."
      // "Student is already enrolled in this course offering."
      // "Cannot enroll a WITHDRAWN student."
      return { success: false, error: err.message };
    }
    console.error("enrollStudentAction failed", err);
    return { success: false, error: "Something went wrong enrolling the student." };
  }
}

export async function dropEnrollmentAction(
  _prevState: ApiResult<{ id: string }> | null,
  formData: FormData
): Promise<ApiResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const parsed = dropEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    courseOfferingId: formData.get("courseOfferingId"),
    reason: formData.get("reason"),
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
    // dropEnrollment() itself enforces "no drop if grades/submissions exist" —
    // we just forward the request and surface whatever it throws.
    const enrollment = await dropEnrollment(
      {
        enrollmentId: parsed.data.enrollmentId,
        reason: parsed.data.reason,
        expectedVersion: parsed.data.expectedVersion,
      },
      user
    );
    revalidatePath(`/enrollments/${parsed.data.courseOfferingId}`);
    return { success: true, data: { id: enrollment.id } };
  } catch (err) {
    if (err instanceof DomainError) {
      // e.g. "Cannot drop an enrollment with recorded grades or submissions."
      return { success: false, error: err.message };
    }
    console.error("dropEnrollmentAction failed", err);
    return { success: false, error: "Something went wrong dropping the enrollment." };
  }
}