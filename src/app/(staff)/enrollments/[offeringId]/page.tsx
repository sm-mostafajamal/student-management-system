import { notFound } from "next/navigation";
import { getOfferingRoster } from "@/server/queries/enrollment-queries";
import { EnrollStudentForm } from "./enroll-student-form";
import { RosterTable } from "./roster-table";

interface PageProps {
  params: Promise<{ offeringId: string }>;
}

export const dynamic = "force-dynamic";

export default async function OfferingEnrollmentsPage({ params }: PageProps) {
  const { offeringId } = await params;
  const offering = await getOfferingRoster(offeringId);
  if (!offering) notFound();

  // "Seats taken" for capacity purposes only counts ENROLLED — matching the
  // same rule enforced server-side in enrollStudent(). DROPPED/COMPLETED/
  // FAILED enrollments don't occupy a seat but still belong on the roster.
  const seatsTaken = offering.enrollments.filter((e) => e.status === "ENROLLED").length;
  const totalOnRoster = offering.enrollments.length;
  const atCapacity = seatsTaken >= (offering?.capacity ?? 0);

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
        <h2 className="mb-3 text-lg font-medium">Current roster ({totalOnRoster})</h2>
        <RosterTable courseOfferingId={offering.id} enrollments={offering.enrollments} />
      </section>
    </div>
  );
}