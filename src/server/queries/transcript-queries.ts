import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/decimal";
import { classifyScore } from "@/types";

export async function listStudentsForProgrammeAndYear(
  programmeId: string,
  academicYearId: string
) {
  const students = await prisma.student.findMany({
    where: {
      programmeId,
      admissionAcademicYearId: academicYearId,
      deletedAt: null,
    },
    include: { user: true },
    orderBy: { studentNumber: "asc" },
  });

  return students.map((s) => ({
    id: s.id,
    studentNumber: s.studentNumber,
    name: `${s.user.firstName} ${s.user.lastName}`,
    status: s.status,
  }));
}

export async function getStudentTranscript(studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, deletedAt: null },
    include: {
      user: true,
      programme: true,
      admissionAcademicYear: true,
    },
  });
  if (!student) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      courseOffering: {
        include: { course: true, academicYear: true },
      },
    },
    orderBy: [
      { courseOffering: { academicYear: { startDate: "asc" } } },
      { courseOffering: { semester: "asc" } },
    ],
  });

  const grades = await prisma.grade.findMany({
    where: { studentId },
  });
  const gradeByOfferingId = new Map(grades.map((g) => [g.courseOfferingId, g]));

  // Group by "Year Name · Semester" so the page can render one section per term.
  const termMap = new Map<
    string,
    {
      academicYearName: string;
      semester: string;
      startDate: Date;
      courses: {
        courseCode: string;
        courseTitle: string;
        creditHours: number;
        numericScore: number | null;
        classification: string | null;
        isPublished: boolean;
      }[];
    }
  >();

  for (const e of enrollments) {
    const key = `${e.courseOffering.academicYear.name}::${e.courseOffering.semester}`;
    if (!termMap.has(key)) {
      termMap.set(key, {
        academicYearName: e.courseOffering.academicYear.name,
        semester: e.courseOffering.semester,
        startDate: e.courseOffering.academicYear.startDate,
        courses: [],
      });
    }
    const grade = gradeByOfferingId.get(e.courseOfferingId);
    const numericScore = grade?.numericScore != null ? toNumber(grade.numericScore) : null;

    termMap.get(key)!.courses.push({
      courseCode: e.courseOffering.course.code,
      courseTitle: e.courseOffering.course.title,
      creditHours: e.courseOffering.course.creditHours,
      numericScore,
      classification:
        numericScore !== null && grade?.isPublished ? classifyScore(numericScore) : null,
      isPublished: grade?.isPublished ?? false,
    });
  }

  const terms = Array.from(termMap.values()).sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  const publishedScores = terms
    .flatMap((t) => t.courses)
    .filter((c) => c.isPublished && c.numericScore !== null)
    .map((c) => c.numericScore as number);
  const overallAverage =
    publishedScores.length > 0
      ? publishedScores.reduce((sum, s) => sum + s, 0) / publishedScores.length
      : null;

  return {
    student: {
      id: student.id,
      studentNumber: student.studentNumber,
      name: `${student.user.firstName} ${student.user.lastName}`,
      status: student.status,
      programmeName: student.programme.name,
      programmeCode: student.programme.code,
      admissionYearName: student.admissionAcademicYear?.name ?? "—",
    },
    terms,
    overallAverage,
    overallClassification: overallAverage !== null ? classifyScore(overallAverage) : null,
  };
}