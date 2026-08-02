import "server-only";
import { prisma } from "@/lib/prisma";
import { getStudentStatusHistory } from "@/services/enrollment-status.service";

export async function getStudentStatusPageData(studentId: string) {
  const [history, activeCourseCount] = await Promise.all([
    getStudentStatusHistory(studentId),
    prisma.enrollment.count({
      where: { studentId, status: { in: ["ENROLLED", "SUSPENDED"] } },
    }),
  ]);

  return { history, activeCourseCount };
}