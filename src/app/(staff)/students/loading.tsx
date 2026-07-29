import { StudentsTableSkeleton } from "@/components/students/students-table-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
      <StudentsTableSkeleton />
    </div>
  );
}