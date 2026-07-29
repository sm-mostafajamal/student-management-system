import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import {
  listAssessments,
  listCourseFilterOptions,
  listProgrammeFilterOptions,
  type AssessmentStatusFilter,
} from "@/server/queries/assessment-queries";
import { AssessmentFilters } from "./assessment-filters";

export const dynamic = "force-dynamic";

const VALID_STATUSES: AssessmentStatusFilter[] = [
  "all",
  "open",
  "closed",
  "late_pending",
];

interface PageProps {
  searchParams: { courseId?: string; programmeId?: string; status?: string };
}

export default async function AssessmentsIndexPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STAFF) redirect("/");

  const status: AssessmentStatusFilter = VALID_STATUSES.includes(
    searchParams.status as AssessmentStatusFilter
  )
    ? (searchParams.status as AssessmentStatusFilter)
    : "all";

  const [assessments, courses, programmes] = await Promise.all([
    listAssessments({
      courseId: searchParams.courseId,
      programmeId: searchParams.programmeId,
      status,
    }),
    listCourseFilterOptions(),
    listProgrammeFilterOptions(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <p className="text-sm text-muted-foreground">
          All assessments across course offerings. Open a row to view its marksheet or submissions.
        </p>
      </div>

      <AssessmentFilters
        courses={courses}
        programmes={programmes}
        selected={{
          courseId: searchParams.courseId,
          programmeId: searchParams.programmeId,
          status,
        }}
      />

      {assessments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assessments match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">Assessment</th>
                <th className="p-3 font-medium">Course</th>
                <th className="p-3 font-medium">Due</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Submissions</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.type.replace(/_/g, " ")}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{a.courseCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.programmeName ?? "—"}
                    </div>
                  </td>
                  <td className="p-3">{a.dueDate.toLocaleDateString()}</td>
                  <td className="p-3">
                    <span
                      className={
                        a.isOpen
                          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {a.isOpen ? "Open" : "Closed"}
                    </span>
                    {a.ungradedLateCount > 0 && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {a.ungradedLateCount} late pending
                      </span>
                    )}
                  </td>
                  <td className="p-3">{a.submissionCount}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3">
                      {/* See assumptions section: [id] here is courseOfferingId — verify against your marksheet route */}
                      <Link
                        href={`/assessments/${a.courseOfferingId}/marksheet`}
                        className="text-sm font-medium hover:underline"
                      >
                        Marksheet
                      </Link>
                      <Link
                        href={`/assessments/${a.id}/submissions`}
                        className="text-sm font-medium hover:underline"
                      >
                        Submissions
                      </Link>
                    </div>
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