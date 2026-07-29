// Central type re-exports and derived application types.
// Domain shape lives in prisma/schema.prisma — this file re-exports Prisma's
// generated enums (single source of truth) and adds types Prisma doesn't
// generate: API envelopes, computed/derived shapes, and relation-inclusive
// views used across services and components.

import type {
  User,
  Student,
  Programme,
  Course,
  CourseOffering,
  AcademicYear,
  Enrollment,
  FeeStructure,
  Fee,
  Payment,
  Assessment,
  Submission,
  Grade,
  GradeChangeLog,
  Prisma,
} from "@prisma/client";

// ─────────────────────────────────────────────
// ENUM RE-EXPORTS
// Always import enums from here (not directly from @prisma/client) so the
// rest of the app has one import path if we ever need to wrap/extend them.
// ─────────────────────────────────────────────

export {
  Role,
  ProgrammeLevel,
  StudentStatus,
  Gender,
  Semester,
  EnrollmentStatus,
  FeeCategory,
  FeeStatus,
  PaymentMethod,
  PaymentStatus,
  AssessmentType,
  SubmissionStatus,
  LetterGrade,
} from "@prisma/client";

export type {
  User,
  Student,
  Programme,
  Course,
  CourseOffering,
  AcademicYear,
  Enrollment,
  FeeStructure,
  Fee,
  Payment,
  Assessment,
  Submission,
  Grade,
  GradeChangeLog,
};

// ─────────────────────────────────────────────
// DECIMAL SERIALIZATION
//
// IMPORTANT: Prisma's `Decimal` fields (Fee.amountDue, Payment.amount, etc.)
// are NOT JSON-serializable as-is. Passing a raw Prisma result across the
// Server Component → Client Component boundary (or through an API route's
// JSON.stringify) will throw or silently produce "[object Object]".
// Services MUST convert Decimal → number (or string, for high-precision
// display) before returning data that crosses that boundary.
//
// `Serialized<T>` documents that conversion at the type level so a
// service's return type makes the conversion visible to whoever consumes it.
// ─────────────────────────────────────────────

export type Serialized<T> = {
  [K in keyof T]: T[K] extends Prisma.Decimal
    ? number
    : T[K] extends Prisma.Decimal | null
      ? number | null
      : T[K] extends Date
        ? Date // Dates ARE serializable by Next.js's RSC boundary; kept as-is
        : T[K];
};

// ─────────────────────────────────────────────
// RELATION-INCLUSIVE VIEWS
// Named, reusable shapes for common query results — avoids ad-hoc inline
// `Prisma.StudentGetPayload<{...}>` scattered across components.
// ─────────────────────────────────────────────

export type StudentWithProgramme = Prisma.StudentGetPayload<{
  include: { programme: true; user: true };
}>;

export type StudentFullProfile = Prisma.StudentGetPayload<{
  include: {
    user: true;
    programme: true;
    enrollments: { include: { courseOffering: { include: { course: true } } } };
    fees: true;
    grades: true;
  };
}>;

export type CourseOfferingWithDetails = Prisma.CourseOfferingGetPayload<{
  include: {
    course: true;
    academicYear: true;
    instructor: true;
    _count: { select: { enrollments: true } };
  };
}>;

export type FeeWithPayments = Prisma.FeeGetPayload<{
  include: { payments: true };
}>;

export type AssessmentWithSubmissions = Prisma.AssessmentGetPayload<{
  include: { submissions: { include: { student: { include: { user: true } } } } };
}>;

export type GradeWithHistory = Prisma.GradeGetPayload<{
  include: { changeLogs: { include: { changedBy: true } } };
}>;

// ─────────────────────────────────────────────
// DERIVED / COMPUTED TYPES
// These are NOT stored in the DB (see schema rationale: Fee.amountPaid is
// deliberately not a column). Services compute and return shapes like this.
// ─────────────────────────────────────────────

export interface FeeBalance {
  feeId: string;
  amountDue: number;
  waivedAmount: number;
  totalPaid: number; // SUM of COMPLETED payments only
  balance: number; // amountDue - waivedAmount - totalPaid
  status: import("@prisma/client").FeeStatus;
  isOverdue: boolean;
}

export interface StudentFinancialSummary {
  studentId: string;
  totalOwed: number;
  totalPaid: number;
  totalWaived: number;
  outstandingBalance: number;
  hasOverdueFees: boolean;
}

export interface StudentAcademicSummary {
  studentId: string;
  cumulativeGpa: number | null; // computed at read time, never cached
  totalCreditHours: number;
  publishedGradeCount: number;
  pendingGradeCount: number;
}

// GPA scale reference used by service-layer grade computation.
// Kept here (not hardcoded in services) so grading policy changes happen
// in one place. 4.0 scale — adjust if PEN Global uses a different scale.
export const GPA_SCALE: Record<import("@prisma/client").LetterGrade, number> = {
  A_PLUS: 4.0,
  A: 4.0,
  A_MINUS: 3.7,
  B_PLUS: 3.3,
  B: 3.0,
  B_MINUS: 2.7,
  C_PLUS: 2.3,
  C: 2.0,
  C_MINUS: 1.7,
  D_PLUS: 1.3,
  D: 1.0,
  F: 0.0,
  INCOMPLETE: 0.0,
  WITHDRAWN: 0.0,
};

// ─────────────────────────────────────────────
// SESSION / ROLE TOGGLE
// Per assessment constraints: no real auth, just a role toggle. Kept as an
// explicit type so it's swappable for a real session/JWT later without
// touching every consumer.
// ─────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: import("@prisma/client").Role;
  studentId?: string; // present only when role === STUDENT
}

// ─────────────────────────────────────────────
// API ENVELOPE
// Consistent shape for route handlers / Server Action returns, so client
// code has one branch to check instead of guessing response shape per route.
// ─────────────────────────────────────────────

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// ASSESSMENT SUBMISSION MODULE — added for this task
// ─────────────────────────────────────────────

export type SubmissionWithStudent = Prisma.SubmissionGetPayload<{
  include: { student: { include: { user: true } } };
}>;

export type AssessmentWithCourseOffering = Prisma.AssessmentGetPayload<{
  include: { courseOffering: { include: { course: true; academicYear: true } } };
}>;

export interface SubmissionActionResult {
  submissionId: string;
  attemptNumber: number;
  isLate: boolean;
  status: import("@prisma/client").SubmissionStatus;
}


// ─────────────────────────────────────────────
// MARKSHEET & RESULTS MODULE — added for this task
//
// Classification is deliberately NOT a stored column — it's derived from
// numericScore at read time, same pattern as StudentAcademicSummary's
// cumulativeGpa. If PEN Global changes the Pass/Merit/Distinction
// thresholds later, that's a one-line change here rather than a data
// migration across every existing Grade row.
// ─────────────────────────────────────────────

export type ResultClassification = "FAIL" | "PASS" | "MERIT" | "DISTINCTION";

export const CLASSIFICATION_THRESHOLDS = {
  DISTINCTION: 70,
  MERIT: 60,
  PASS: 40,
} as const;

export function classifyScore(numericScore: number): ResultClassification {
  if (numericScore >= CLASSIFICATION_THRESHOLDS.DISTINCTION) return "DISTINCTION";
  if (numericScore >= CLASSIFICATION_THRESHOLDS.MERIT) return "MERIT";
  if (numericScore >= CLASSIFICATION_THRESHOLDS.PASS) return "PASS";
  return "FAIL";
}

/// One row per enrolled student in a course offering, for the staff
/// marksheet view. gradeId/numericScore/etc are null when staff hasn't
/// entered a result for that student yet — the marksheet shows every
/// enrolled student, not just the ones already graded, so a missing
/// result is visible as a gap rather than silently absent from the list.
export interface MarksheetEntry {
  studentId: string;
  studentNumber: string;
  studentName: string;
  gradeId: string | null;
  numericScore: number | null;
  classification: ResultClassification | null;
  isPublished: boolean;
  version: number | null;
}

export interface PublishedResultView {
  gradeId: string;
  courseCode: string;
  courseTitle: string;
  numericScore: number;
  classification: ResultClassification;
  publishedAt: Date | null;
}