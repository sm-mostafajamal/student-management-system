import { listActiveProgrammes, listAcademicYears } from "@/services/reference-data.service";
import { StudentForm } from "@/components/students/student-form";

export default async function NewStudentPage() {
  const [programmes, academicYears] = await Promise.all([listActiveProgrammes(), listAcademicYears()]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">New Student</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Student ID is generated automatically on save (format SMS-YYYY-XXXX).
      </p>
      <StudentForm mode="create" programmes={programmes} academicYears={academicYears} />
    </div>
  );
}