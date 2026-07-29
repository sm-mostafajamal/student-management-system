import Link from "next/link";
import { listOpenCourseOfferings } from "@/server/queries/enrollment-queries";

export const dynamic = "force-dynamic";

export default async function EnrollmentsHubPage() {
  const offerings = await listOpenCourseOfferings();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Enrolments</h1>
        <p className="text-sm text-muted-foreground">
          Select a course offering to view its roster, enrol a student, or drop an existing enrolment.
        </p>
      </div>

      {offerings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open course offerings found for the current term.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {offerings.map((o) => {
            const seatsTaken = o._count.enrollments;
            const atCapacity = seatsTaken >= o.capacity;
            return (
              <li key={o.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {o.course.code} — {o.course.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {seatsTaken} / {o.capacity} seats
                    {atCapacity && (
                      <span className="ml-2 font-medium text-destructive">Full</span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/enrollments/${o.id}`}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  Manage roster
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}