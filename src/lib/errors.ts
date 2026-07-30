/**
 * src/lib/errors.ts
 *
 * Application error handling primitives.
 *
 * Design:
 * - `AppError` is the base error class. All service-layer throws use this so
 *   route handlers can distinguish domain errors (expected, user-visible) from
 *   unexpected errors (log + 500).
 * - `ok()` and `fail()` are constructors for `ApiResult<T>` — they keep
 *   service return sites concise and the shape consistent.
 * - `handleServiceError` is the ONE place that maps errors → HTTP responses.
 *   Route handlers call this instead of writing try/catch boilerplate.
 *
 * SOLID note: Open/Closed — add new error codes without changing the handler.
 */

import { NextResponse } from "next/server";
import type { ApiResult } from "@/types";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

// ─── Error codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "PAYMENT_DUPLICATE"
  | "ENROLLMENT_CAPACITY"
  | "INTERNAL_ERROR"
  | "DUPLICATE_EMAIL";

const HTTP_STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  PAYMENT_DUPLICATE: 409,
  ENROLLMENT_CAPACITY: 409,
  INTERNAL_ERROR: 500,
  DUPLICATE_EMAIL : 409
};

// ─── AppError ─────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toApiResult(): ApiResult<never> {
    return {
      success: false,
      error: this.message,
      ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
    };
  }
}

// ─── ApiResult constructors ───────────────────────────────────────────────────

export function ok<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>
): ApiResult<never> {
  return { success: false, error, ...(fieldErrors ? { fieldErrors } : {}) };
}

// ─── Zod error formatter ─────────────────────────────────────────────────────

/**
 * Converts a ZodError into the `fieldErrors` shape used by ApiResult.
 * Enables client-side forms to display per-field validation messages.
 */
export function formatZodError(error: ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

// ─── Route handler error mapper ───────────────────────────────────────────────

/**
 * Converts any thrown error into a well-formed NextResponse JSON.
 * Call this in the catch block of every route handler.
 *
 * Usage:
 *   } catch (err) {
 *     return handleServiceError(err);
 *   }
 */
export function handleServiceError(err: unknown): NextResponse {
  // Known domain error — user-visible message, correct status code
  if (err instanceof AppError) {
    return NextResponse.json(err.toApiResult(), {
      status: HTTP_STATUS[err.code],
    });
  }

  // Zod validation error slipping past the service layer
  if (err instanceof ZodError) {
    return NextResponse.json(
      fail("Validation failed", formatZodError(err)),
      { status: 422 }
    );
  }

  // Prisma unique constraint violation — surface as CONFLICT
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined)?.join(", ");
      return NextResponse.json(
        fail(`Duplicate value${fields ? ` on ${fields}` : ""}`),
        { status: 409 }
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(fail("Record not found"), { status: 404 });
    }
  }

  // Unknown — log and return generic 500
  console.error("[UnhandledError]", err);
  return NextResponse.json(fail("An unexpected error occurred"), {
    status: 500,
  });
}

// ─── Service-layer guard helpers ──────────────────────────────────────────────

/** Throws NOT_FOUND if value is null/undefined. */
export function assertFound<T>(
  value: T | null | undefined,
  label = "Record"
): asserts value is T {
  if (value == null) {
    throw new AppError("NOT_FOUND", `${label} not found`);
  }
}

/** Throws FORBIDDEN if condition is false. */
export function assertPermission(
  condition: boolean,
  message = "Permission denied"
): asserts condition {
  if (!condition) {
    throw new AppError("FORBIDDEN", message);
  }
}
// src/lib/errors.ts
// A single typed error the service layer throws for known, expected
// business-rule violations (not-found, forbidden, deadline passed, etc.).
// Action layers catch this specifically and surface err.message to the UI;
// anything else is an unexpected error and gets a generic message + log.

export class DomainError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "NOT_ENROLLED"
      | "DEADLINE_PASSED"
      | "MAX_ATTEMPTS_REACHED"
      | "INVALID_FILE"
      | "WEIGHT_EXCEEDED"
      | "REASON_REQUIRED"
      | "CONFLICT",
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}