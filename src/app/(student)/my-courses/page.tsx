import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { listCurrentEnrollmentsForStudent } from "@/server/queries/student-course-queries";

export const dynamic = "force-dynamic";

export default async function MyCoursesPage() {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) redirect("/");

  const enrollments = await listCurrentEnrollmentsForStudent(user.studentId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">My Courses</h1>
        <p className="text-sm text-muted-foreground">
          Courses you're currently enrolled in. Open an assessment to view or submit your work.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have no active enrolments this term.</p>
      ) : (
        <div className="space-y-6">
          {enrollments.map((e) => (
            <section key={e.id} className="rounded-md border p-4">
              <div className="mb-3">
                <h2 className="font-medium">
                  {e.courseOffering.course.code} — {e.courseOffering.course.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {e.courseOffering.semester.replace(/_/g, " ")} ·
                  {e.courseOffering.academicYear.name}
                  {e.courseOffering.instructor &&
                    ` · ${e.courseOffering.instructor.firstName} ${e.courseOffering.instructor.lastName}`}
                </p>
              </div>

              {e.courseOffering.assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessments posted yet.</p>
              ) : (
                <ul className="divide-y">
                  {e.courseOffering.assessments.map((a) => {
                    // Derived the same way the staff assessments list computes it:
                    // an assessment stays open until its due date plus grace period.
                    const isOpen =
                      Date.now() <= a.dueDate.getTime() + a.gracePeriodMinutes * 60_000;

                    return (
                      <li key={a.id} className="flex items-center justify-between py-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{a.title}</p>
                            <span
                              className={
                                isOpen
                                  ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              }
                            >
                              {isOpen ? "Open" : "Closed"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Due {a.dueDate.toLocaleDateString()}
                          </p>
                        </div>
                        {/* Moved from src/app/(staff)/students/assessments/[id]/page.tsx — see note below */}
                        <Link
                          href={`/my-courses/assessments/${a.id}`}
                          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                        >
                          View / submit
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}