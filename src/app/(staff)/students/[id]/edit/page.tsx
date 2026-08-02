import { notFound } from "next/navigation";
import { getStudentById } from "@/services/student.service";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { getStudentStatusPageData } from "@/server/queries/student-status-queries";
import { AppError } from "@/lib/errors";
import { StudentForm } from "@/components/students/student-form";
import { StudentStatusBadge } from "@/components/students/status-badge";
import { ChangeStatusModal } from "@/components/students/change-status-modal";
import { StatusHistoryTimeline } from "@/components/students/status-history-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const [programmes, { history, activeCourseCount }] = await Promise.all([
    listProgrammesForFilter(),
    getStudentStatusPageData(id),
  ]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Edit Student</h1>
        <p className="text-sm text-muted-foreground">{student.studentNumber}</p>
      </div>

      {/* Student Summary Card */}
    <Card className="py-5">
    <CardHeader className="flex flex-row items-start justify-between gap-4 px-5">
        <div className="space-y-1">
        <CardTitle className="text-base">
            {student.user.firstName} {student.user.lastName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
            {student.programme.code} — {student.programme.name}
        </p>
        <p className="text-xs text-muted-foreground">
            {activeCourseCount} active course{activeCourseCount === 1 ? "" : "s"}
        </p>
        </div>
        <div className="flex flex-col items-end gap-2 pr-1">
        <StudentStatusBadge status={student.status} />
        <ChangeStatusModal studentId={student.id} currentStatus={student.status} />
        </div>
    </CardHeader>
    </Card>

      <StudentForm mode="edit" student={student} programmes={programmes} />

      {/* Status History Timeline / Audit History */}
      <Card className="py-5">
        <CardHeader className="px-5">
            <CardTitle className="text-base">Status History</CardTitle>
        </CardHeader>
        <CardContent className="px-5">
            <StatusHistoryTimeline entries={history} />
        </CardContent>
      </Card>
    </div>
  );
}