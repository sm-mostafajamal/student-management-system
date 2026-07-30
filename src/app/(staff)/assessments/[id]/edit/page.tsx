import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getAssessmentForEditOr404 } from "@/services/assessment.service";
import { EditAssessmentForm } from "@/components/assessments/EditAssessmentForm";
import { Role } from "@/types";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) {
    redirect("/");
  }

  const assessment = await getAssessmentForEditOr404(id).catch(() => null);
  if (!assessment) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/assessments"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        ← Back to assessments
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Edit Assessment
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {assessment.courseOffering.course.code} · {assessment.courseOffering.academicYear?.name ?? ""}
      </p>
      <div className="mt-6">
        <EditAssessmentForm
          assessment={{
            id: assessment.id,
            title: assessment.title,
            type: assessment.type,
            weightPercentage: Number(assessment.weightPercentage),
            maxScore: Number(assessment.maxScore),
            dueDate: assessment.dueDate,
            gracePeriodMinutes: assessment.gracePeriodMinutes,
            maxAttempts: assessment.maxAttempts,
          }}
          hasSubmissions={assessment.hasSubmissions}
        />
      </div>
    </main>
  );
}