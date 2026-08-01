import "server-only";
import { prisma } from "@/lib/prisma";

export async function listOpenCourseOfferings() {
  return prisma.courseOffering.findMany({
    where: { deletedAt: null },
    include: {
      course: { select: { code: true, title: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ course: { code: "asc" } }],
  });
}

export type OfferingRoster = NonNullable<Awaited<ReturnType<typeof getOfferingRoster>>>;

export async function getOfferingRoster(courseOfferingId: string) {
  return prisma.courseOffering.findUnique({
    where: { id: courseOfferingId },
    include: {
      course: { select: { code: true, title: true } },
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              status: true,
              studentNumber : true,

              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}