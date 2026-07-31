"use server";

import { revalidatePath } from "next/cache";
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateOfferingSchema,
  UpdateOfferingSchema,
} from "@/lib/validations/programme-course";
import {
  createCourse,
  updateCourse,
  createOffering,
  updateOffering,
} from "@/services/course.service";
import { ServiceError } from "@/services/programme.service";
import { requireStaff } from "@/lib/auth-helpers";
import type { ActionResult } from "./programme.actions";

// ─── Course: Create ───────────────────────────────────────────────────────────

export async function createCourseAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const raw = {
    code: formData.get("code"),
    title: formData.get("title"),
    creditHours: Number(formData.get("creditHours")),
    programmeId: formData.get("programmeId"),
  };

  const parsed = CreateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first.message, field: first.path[0] as string };
  }

  try {
    const course = await createCourse(parsed.data);
    revalidatePath("/courses");
    revalidatePath(`/programmes/${parsed.data.programmeId}`);
    return { success: true, data: { id: course.id } };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[createCourseAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Course: Update ───────────────────────────────────────────────────────────

export async function updateCourseAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const raw = {
    id: formData.get("id"),
    code: formData.get("code"),
    title: formData.get("title"),
    creditHours: Number(formData.get("creditHours")),
    programmeId: formData.get("programmeId"),
    isActive: formData.get("isActive") === "true",
  };

  const parsed = UpdateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first.message, field: first.path[0] as string };
  }

  try {
    await updateCourse(parsed.data);
    revalidatePath("/courses");
    revalidatePath(`/courses/${parsed.data.id}`);
    revalidatePath(`/programmes/${parsed.data.programmeId}`);
    return { success: true, data: { id: parsed.data.id } };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[updateCourseAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Offering: Create ─────────────────────────────────────────────────────────

export async function createOfferingAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const raw = {
    courseId: formData.get("courseId"),
    academicYearId: formData.get("academicYearId"),
    semester: formData.get("semester"),
    instructorId: formData.get("instructorId"),
    capacity: Number(formData.get("capacity")),
  };

  const parsed = CreateOfferingSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first.message, field: first.path[0] as string };
  }

  try {
    const offering = await createOffering(parsed.data);
    revalidatePath("/course-offerings");
    revalidatePath(`/courses/${parsed.data.courseId}`);
    return { success: true, data: { id: offering.id } };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[createOfferingAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Offering: Update ─────────────────────────────────────────────────────────

export async function updateOfferingAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const raw = {
    id: formData.get("id"),
    instructorId: formData.get("instructorId"),
    capacity: Number(formData.get("capacity")),
    isActive: formData.get("isActive") === "true",
  };

  const parsed = UpdateOfferingSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first.message, field: first.path[0] as string };
  }

  try {
    await updateOffering(parsed.data);
    revalidatePath("/course-offerings");
    revalidatePath(`/course-offerings/${parsed.data.id}`);
    return { success: true, data: { id: parsed.data.id } };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[updateOfferingAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}