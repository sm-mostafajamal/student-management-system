import { CreateAssessmentForm } from "@/components/assessments/CreateAssessmentForm";
import { listOfferings } from "@/services/course.service";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  searchParams: Promise<{ courseOfferingId?: string }>;
}

export default async function NewAssessmentPage({ searchParams }: PageProps) {
  await requireStaff();
  const { courseOfferingId } = await searchParams;

  // This route (/assessments/new) has no dynamic segment, so it cannot read an
  // `id` from params — it must fetch the list of course offerings itself and
  // let staff pick one from a dropdown.
  const { items: offerings } = await listOfferings({ pageSize: 200 });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        New Assessment
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Students will be able to upload a PDF or DOCX submission until the deadline.
      </p>
      <div className="mt-6">
        <CreateAssessmentForm
          courseOfferings={offerings}
          defaultCourseOfferingId={courseOfferingId}
        />
      </div>
    </main>
  );
}