import { Badge } from "@/components/ui/badge";
import type { StudentStatus } from "@/types";

// Spec colors: Enrolled = green, Deferred = orange, Withdrawn = red, Completed = blue.
const STYLES: Record<StudentStatus, string> = {
  ENROLLED: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  DEFERRED: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  WITHDRAWN: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}