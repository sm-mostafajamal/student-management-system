import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Role } from "@/types";
import { getAssessmentForStudent } from "@/server/queries/student-assessment-queries";
import { SubmissionForm } from "./submission-form";
import { LiveStatusBadge } from "@/components/assessments/LiveStatusBadge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentAssessmentPage({ params }: PageProps) {
  const user = await getSessionUser();
  if (!user || user.role !== Role.STUDENT || !user.studentId) redirect("/");

  const { id } = await params;
  const result = await getAssessmentForStudent(id, user.studentId);
  if (!result) notFound();

  const { assessment, submission } = result;

  const maxScore = Number(assessment.maxScore);
  const weightPercentage = Number(assessment.weightPercentage);
  const deadline = new Date(
    assessment.dueDate.getTime() + assessment.gracePeriodMinutes * 60_000
  );

  // Mirrors submitAssessment()'s own rule exactly: lateness/lockout is
  // decided by comparing NOW to the deadline, not by reading
  // submission.isLate (which only records whether THAT PARTICULAR
  // submission, made in the past, happened to be late at the time).
  // These are different questions — don't conflate them.
  const isPastDeadline = Date.now() > deadline.getTime();
  const attemptsExhausted = submission
    ? submission.attemptNumber >= assessment.maxAttempts
    : false;
  const resubmissionBlocked = Boolean(submission) && isPastDeadline;
  const canSubmit = !submission || (!resubmissionBlocked && !attemptsExhausted);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{assessment.title}</h1>
        <p className="text-sm text-muted-foreground">
          {assessment.courseOffering.course.code} — {assessment.courseOffering.course.title}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-md border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Type</p>
          <p className="font-medium">{assessment.type.replace(/_/g, " ")}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Weight</p>
          <p className="font-medium">{weightPercentage}%</p>
        </div>
        <div>
          <p className="text-muted-foreground">Max score</p>
          <p className="font-medium">{maxScore}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Due</p>
          <p className="font-medium">
            {assessment.dueDate.toLocaleString()}
            {assessment.gracePeriodMinutes > 0 && ` (+${assessment.gracePeriodMinutes}m grace)`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <LiveStatusBadge dueDate={assessment.dueDate} gracePeriodMinutes={assessment.gracePeriodMinutes} />
        </div>
      </div>

      {submission ? (
        <div className="rounded-md border p-4">
          <h2 className="mb-2 font-medium">Your current submission</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">File</dt>
              <dd>
                <Link
                  href={`/api/submissions/${submission.id}/file`}
                  className="font-medium hover:underline"
                >
                  {submission.originalFileName ?? "Download"}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{submission.submittedAt.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Attempt</dt>
              <dd>
                {submission.attemptNumber} / {assessment.maxAttempts}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Was it late</dt>
              <dd>
                {submission.isLate ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Late
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    On time
                  </span>
                )}
              </dd>
            </div>
            {submission.score !== null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Score</dt>
                <dd>
                  {Number(submission.score)} / {maxScore}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You haven't submitted anything yet.</p>
      )}

      {resubmissionBlocked && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          The deadline has passed — your existing submission is final and can no longer be
          replaced.
        </p>
      )}
      {!resubmissionBlocked && attemptsExhausted && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          You've used all {assessment.maxAttempts} allowed attempt(s) for this assessment.
        </p>
      )}

      {canSubmit && (
        <SubmissionForm
          assessmentId={assessment.id}
          isResubmission={Boolean(submission)}
          isPastDeadline={isPastDeadline}
        />
      )}
    </div>
  );
}