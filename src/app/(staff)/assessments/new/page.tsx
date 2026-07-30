import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOfferingById } from "@/services/course.service";
import { CreateAssessmentForm } from "@/components/assessments/CreateAssessmentForm";
import { requireStaff } from "@/lib/auth-helpers";

const SEMESTER_LABELS: Record<string, string> = {
  FIRST_SEMESTER: "Fall",
  SECOND_SEMESTER: "Spring",
  SUMMER_SEMESTER: "Summer",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewAssessmentPage({ params }: PageProps) {
  await requireStaff();
  const { id: courseOfferingId } = await params;

  const offering = await getOfferingById(courseOfferingId);
  if (!offering) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/course-offerings/${courseOfferingId}`}
        className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to offering
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        New Assessment
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        For{" "}
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {offering.course.code} — {offering.course.title}
        </span>{" "}
        ({offering.academicYear.name} · {SEMESTER_LABELS[offering.semester] ?? offering.semester}).
        Students will be able to upload a PDF or DOCX submission until the deadline.
      </p>

      <div className="mt-6">
        <CreateAssessmentForm courseOfferingId={courseOfferingId} />
      </div>
    </main>
  );
}