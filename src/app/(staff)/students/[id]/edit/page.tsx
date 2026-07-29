import { notFound } from "next/navigation";
import { getStudentById } from "@/services/student.service";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { AppError } from "@/lib/errors";
import { StudentForm } from "@/components/students/student-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStudentPage({ params }: PageProps) {
  const { id } = await params;

  let student;
  try {
    student = await getStudentById(id);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const programmes = await listProgrammesForFilter();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Edit Student</h1>
      <p className="mb-6 text-sm text-muted-foreground">{student.studentNumber}</p>
      <StudentForm mode="edit" student={student} programmes={programmes} />
    </div>
  );
}