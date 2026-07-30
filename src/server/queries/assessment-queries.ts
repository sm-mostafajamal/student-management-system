import "server-only";
import { prisma } from "@/lib/prisma";
import type { AssessmentType } from "@/types";

export type AssessmentStatusFilter = "all" | "open" | "closed" | "late_pending";

export interface AssessmentListFilters {
  courseId?: string;
  programmeId?: string;
  status?: AssessmentStatusFilter;
}

export interface AssessmentListRow {
  id: string;
  title: string;
  type: AssessmentType;
  dueDate: Date;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  programmeName: string | null;
  submissionCount: number;
  /** Late (isLate=true) submissions with no gradedAt yet — needs staff attention. */
  ungradedLateCount: number;
  /** Derived from dueDate + gracePeriodMinutes vs now. Not a stored field. */
  isOpen: boolean;
}

export async function listAssessments(
  filters: AssessmentListFilters
): Promise<AssessmentListRow[]> {
  const assessments = await prisma.assessment.findMany({
    where: {
      deletedAt: null,
      courseOffering: {
        deletedAt: null,
        ...(filters.courseId ? { courseId: filters.courseId } : {}),
        ...(filters.programmeId
          ? { course: { programmeId: filters.programmeId } }
          : {}),
      },
    },
    include: {
      courseOffering: { include: { course: { include: { programme: true } } } },
      submissions: {
        where: { isCurrent: true },
        select: { isLate: true, gradedAt: true },
      },
    },
    orderBy: { dueDate: "desc" },
  });

  const now = Date.now();

  const rows: AssessmentListRow[] = assessments.map((a) => {
    const graceMs = a.gracePeriodMinutes * 60_000;
    const isOpen = now <= a.dueDate.getTime() + graceMs;
    const ungradedLateCount = a.submissions.filter(
      (s) => s.isLate && !s.gradedAt
    ).length;

    return {
      id: a.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate,
      courseOfferingId: a.courseOfferingId,
      courseCode: a.courseOffering.course.code,
      courseTitle: a.courseOffering.course.title,
      programmeName: a.courseOffering.course.programme?.name ?? null,
      submissionCount: a.submissions.length,
      ungradedLateCount,
      isOpen,
    };
  });

  switch (filters.status) {
    case "open":
      return rows.filter((r) => r.isOpen);
    case "closed":
      return rows.filter((r) => !r.isOpen);
    case "late_pending":
      return rows.filter((r) => r.ungradedLateCount > 0);
    default:
      return rows;
  }
}

export async function listCourseFilterOptions() {
  return prisma.course.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, title: true },
    orderBy: { code: "asc" },
  });
}

export async function listProgrammeFilterOptions() {
  return prisma.programme.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}