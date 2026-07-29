import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserRoundPlus, SearchX } from "lucide-react";

export function StudentEmptyState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium text-foreground">No students match your filters</p>
        <p className="text-sm text-muted-foreground">Try adjusting the search, programme, or status filter.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <UserRoundPlus className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium text-foreground">No students yet</p>
      <p className="text-sm text-muted-foreground">Get started by enrolling your first student.</p>
      <Button asChild size="sm" className="mt-2">
        <Link href="/students/new">New Student</Link>
      </Button>
    </div>
  );
}