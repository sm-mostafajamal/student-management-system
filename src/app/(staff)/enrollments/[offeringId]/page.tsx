import { notFound } from "next/navigation";
import { getOfferingRoster } from "@/server/queries/enrollment-queries";
import { EnrollStudentForm } from "./enroll-student-form";
import { RosterTable } from "./roster-table";

interface PageProps {
  params: { offeringId: string };
}

export const dynamic = "force-dynamic";

export default async function OfferingEnrollmentsPage({ params }: PageProps) {
  const offering = await getOfferingRoster(params.offeringId);
  if (!offering) notFound();

  const seatsTaken = offering._count.enrollments;
  const atCapacity = seatsTaken >= offering.capacity;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {offering.course.code} — {offering.course.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {seatsTaken} / {offering.capacity} seats enrolled
          {atCapacity && <span className="ml-2 font-medium text-destructive">At capacity</span>}
        </p>
      </div>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">Enroll a student</h2>
        <EnrollStudentForm courseOfferingId={offering.id} atCapacity={atCapacity} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Current roster ({seatsTaken})</h2>
        <RosterTable courseOfferingId={offering.id} enrollments={offering.enrollments} />
      </section>
    </div>
  );
}