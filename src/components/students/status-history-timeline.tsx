import { formatDate } from "@/lib/utils";
import { StudentStatusBadge } from "./status-badge";
import type { StudentStatus } from "@/types";
import { History } from "lucide-react";

interface HistoryEntry {
  id: string;
  oldStatus: StudentStatus | null;
  newStatus: StudentStatus;
  reason: string;
  notes: string | null;
  changedAt: Date | string;
  changedBy: { firstName: string; lastName: string; email: string };
}

export function StatusHistoryTimeline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
        <History className="h-4 w-4" />
        No status changes recorded yet.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border ml-2 space-y-6">
      {entries.map((entry) => (
        <li key={entry.id} className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="flex flex-wrap items-center gap-2">
            {entry.oldStatus && <StudentStatusBadge status={entry.oldStatus} />}
            {entry.oldStatus && <span className="text-muted-foreground text-xs">→</span>}
            <StudentStatusBadge status={entry.newStatus} />
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDate(entry.changedAt)}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1">{entry.reason}</p>
          {entry.notes && <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            by {entry.changedBy.firstName} {entry.changedBy.lastName}
          </p>
        </li>
      ))}
    </ol>
  );
}