import { CreateAssessmentForm } from "@/components/assessments/CreateAssessmentForm";
import { listOfferings } from "@/services/course.service";
import { requireStaff } from "@/lib/auth-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ courseOfferingId?: string }>;
}

export default async function NewAssessmentPage({ params, searchParams }: PageProps) {
  await requireStaff();

  // This route IS nested under /course-offerings/[id], so the offering is
  // already known from the URL path — use it as the default. Still accept
  // ?courseOfferingId= as an override, in case this component is ever
  // linked to from somewhere else with an explicit query param.
  const { id: courseOfferingIdFromPath } = await params;
  const { courseOfferingId: courseOfferingIdFromQuery } = await searchParams;
  const defaultCourseOfferingId = courseOfferingIdFromQuery ?? courseOfferingIdFromPath;

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
          defaultCourseOfferingId={defaultCourseOfferingId}
        />
      </div>
    </main>
  );
}