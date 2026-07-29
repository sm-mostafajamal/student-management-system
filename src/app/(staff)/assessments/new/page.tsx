import { CreateAssessmentForm } from "@/components/assessments/CreateAssessmentForm";

export default async function NewAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        New Assessment
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Students will be able to upload a PDF or DOCX submission until the deadline.
      </p>
      <div className="mt-6">
        <CreateAssessmentForm courseOfferingId={id} />
      </div>
    </main>
  );
}