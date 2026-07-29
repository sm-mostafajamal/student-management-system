import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { listCourseOfferingGradeSummaries } from "@/server/queries/grade-summary-queries";

export const dynamic = "force-dynamic";

export default async function GradesIndexPage() {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");

  const offerings = await listCourseOfferingGradeSummaries();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Grades</h1>
        <p className="text-sm text-muted-foreground">
          Published / unpublished result counts per course offering.
        </p>
      </div>

      {offerings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No course offerings found.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">Course</th>
                <th className="p-3 font-medium">Term</th>
                <th className="p-3 font-medium">Enrolled</th>
                <th className="p-3 font-medium">Published</th>
                <th className="p-3 font-medium">Unpublished</th>
                <th className="p-3 font-medium">Not yet graded</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{o.courseCode}</div>
                    <div className="text-xs text-muted-foreground">{o.courseTitle}</div>
                  </td>
                  <td className="p-3 text-sm">
                    {o.semester.replace(/_/g, " ")} · {o.academicYearName}
                  </td>
                  <td className="p-3">{o.enrolledCount}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      {o.publishedCount}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {o.unpublishedCount}
                    </span>
                  </td>
                  <td className="p-3">
                    {o.missingCount > 0 ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {o.missingCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {/* See assumptions section re: [id] = courseOfferingId */}
                    <Link
                      href={`/assessments/${o.id}/marksheet`}
                      className="text-sm font-medium hover:underline"
                    >
                      Open marksheet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}