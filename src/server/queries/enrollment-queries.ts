import "server-only";
import { db } from "@/lib/db"; // ASSUMPTION: shared PrismaClient instance lives here

export async function listOpenCourseOfferings() {
  return db.courseOffering.findMany({
    where: { status: "OPEN" }, // ASSUMPTION: adjust field/enum to your schema
    include: {
      course: { select: { code: true, title: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ course: { code: "asc" } }],
  });
}

export type OfferingRoster = NonNullable<Awaited<ReturnType<typeof getOfferingRoster>>>;

export async function getOfferingRoster(courseOfferingId: string) {
  return db.courseOffering.findUnique({
    where: { id: courseOfferingId },
    include: {
      course: { select: { code: true, title: true } },
      enrollments: {
        where: { status: { not: "DROPPED" } }, // ASSUMPTION: EnrollmentStatus enum
        include: {
          student: { select: { id: true, fullName: true, email: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });
}