import "server-only";
import { db } from "@/lib/db";
import { EnrollmentStatus } from "@/types";

export async function listCurrentEnrollmentsForStudent(studentId: string) {
  return db.enrollment.findMany({
    where: { studentId, status: EnrollmentStatus.ENROLLED },
    include: {
      courseOffering: {
        include: {
          course: true,
          academicYear: true,
          instructor: { select: { firstName: true, lastName: true } },
          assessments: {
            where: { deletedAt: null },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}