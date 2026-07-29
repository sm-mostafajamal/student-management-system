import { Skeleton } from "@/components/ui/skeleton";

export function StudentsTableSkeleton() {
  return (
    <div className="rounded-md border">
      <div className="border-b p-3">
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-3 last:border-none">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      ))}
    </div>
  );
}