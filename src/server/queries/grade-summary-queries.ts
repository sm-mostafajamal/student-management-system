import "server-only";
import { prisma } from "@/lib/prisma";
import type { Semester } from "@/types";

export interface CourseOfferingGradeSummary {
  id: string;
  courseCode: string;
  courseTitle: string;
  academicYearName: string;
  semester: Semester;
  enrolledCount: number;
  publishedCount: number;
  unpublishedCount: number;
  /** Enrolled students who don't have a Grade row at all yet. */
  missingCount: number;
}

export async function listCourseOfferingGradeSummaries(): Promise<
  CourseOfferingGradeSummary[]
> {
  const offerings = await prisma.courseOffering.findMany({
    where: { deletedAt: null },
    include: {
      course: true,
      academicYear: true,
      _count: { select: { enrollments: true } },
      grades: { select: { isPublished: true } },
    },
    orderBy: [{ academicYear: { isCurrent: "desc" } }, { course: { code: "asc" } }],
  });

  return offerings.map((o) => {
    const publishedCount = o.grades.filter((g) => g.isPublished).length;
    const unpublishedCount = o.grades.length - publishedCount;
    return {
      id: o.id,
      courseCode: o.course.code,
      courseTitle: o.course.title,
      academicYearName: o.academicYear.name,
      semester: o.semester,
      enrolledCount: o._count.enrollments,
      publishedCount,
      unpublishedCount,
      missingCount: Math.max(0, o._count.enrollments - o.grades.length),
    };
  })
}