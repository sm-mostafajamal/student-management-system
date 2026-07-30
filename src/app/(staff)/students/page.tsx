import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { studentQuerySchema } from "@/lib/validations/student.schema";
import { listStudents } from "@/services/student.service";
import { listProgrammesForFilter } from "@/services/reference-data.service";
import { StudentsFilters } from "@/components/students/students-filters";
import { StudentsTable } from "@/components/students/students-table";
import { StudentsTableSkeleton } from "@/components/students/students-table-skeleton";
import { getSessionUser } from "@/lib/session"; 
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const user = await getSessionUser();                 
  if (!user || user.role !== "STAFF") redirect("/");  
  const raw = await searchParams;
  const query = studentQuerySchema.parse({
    search: typeof raw.search === "string" ? raw.search : undefined,
    programmeId: typeof raw.programmeId === "string" ? raw.programmeId : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
    pageSize: typeof raw.pageSize === "string" ? raw.pageSize : undefined,
  });

  const programmes = await listProgrammesForFilter();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">Manage student enrollment records.</p>
        </div>
        <Link href="/students/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Student
          </Button>
        </Link> 
      </div>

      <StudentsFilters programmes={programmes} />

      {/* key forces a fresh Suspense boundary per query, so filter changes
          show the skeleton instead of a frozen stale table. */}
      <Suspense key={JSON.stringify(query)} fallback={<StudentsTableSkeleton />}>
        <StudentsTableSection query={query} />
      </Suspense>
    </div>
  );
}

async function StudentsTableSection({ query }: { query: ReturnType<typeof studentQuerySchema.parse> }) {
  const result = await listStudents(query);
  return <StudentsTable result={result} />;
}