"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CreateProgrammeSchema, UpdateProgrammeSchema } from "@/lib/validations/programme-course";
import {
  createProgramme,
  updateProgramme,
  ServiceError,
} from "@/services/programme.service";
import { requireStaff } from "@/lib/auth-helpers";

// ─── Shared result type ───────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; field?: string };

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createProgrammeAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireStaff();

  const raw = {
    code: formData.get("code"),
    name: formData.get("name"),
    level: formData.get("level"),
    durationYears: formData.get("durationYears"),
    departmentName: formData.get("departmentName") || undefined,
  };

  const parsed = CreateProgrammeSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: first.message,
      field: first.path[0] as string,
    };
  }

  try {
    const programme = await createProgramme(parsed.data);
    revalidatePath("/programmes");
    return { success: true, data: { id: programme.id } };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[createProgrammeAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateProgrammeAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireStaff();

  const raw = {
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    level: formData.get("level"),
    durationYears: formData.get("durationYears"),
    departmentName: formData.get("departmentName") || undefined,
    isActive: formData.get("isActive") === "true",
  };

  const parsed = UpdateProgrammeSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: first.message,
      field: first.path[0] as string,
    };
  }

  try {
    await updateProgramme(parsed.data);
    revalidatePath("/programmes");
    revalidatePath(`/programmes/${parsed.data.id}`);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof ServiceError) {
      return { success: false, error: err.message, field: err.field };
    }
    console.error("[updateProgrammeAction]", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}