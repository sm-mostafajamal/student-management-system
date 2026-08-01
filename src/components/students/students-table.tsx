"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { StudentStatusBadge } from "./status-badge";
import { StudentEmptyState } from "./student-empty-state";
import { DeleteStudentDialog } from "./delete-student-dialog";
import type { StudentWithProgramme, PaginatedResult } from "@/types";
import { Route } from "next";

export function StudentsTable({ result }: { result: PaginatedResult<StudentWithProgramme> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasFilters = Boolean(searchParams.get("search") || searchParams.get("programmeId") || searchParams.get("status"));

  if (result.items.length === 0) {
    return (
      <div className="rounded-md border">
        <StudentEmptyState hasFilters={hasFilters} />
      </div>
    );
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}` as Route);
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Programme</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.items.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-sm">{s.studentNumber}</TableCell>
              <TableCell>
                <div className="font-medium text-foreground">
                  {s.user.firstName} {s.user.lastName}
                </div>
                <div className="text-xs text-muted-foreground">{s.user.email}</div>
              </TableCell>
              <TableCell>
                {s.programme.code}
                {!s.programme.isActive && <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>}
              </TableCell>
              <TableCell>
                <StudentStatusBadge status={s.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  nativeButton={false}
                  render={<Link href={`/students/${s.id}/edit`} />}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit {s.user.firstName}</span>
                </Button>
                <DeleteStudentDialog studentId={s.id} studentName={`${s.user.firstName} ${s.user.lastName}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
        <span>
          Showing {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} of
          {result.total}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={result.page <= 1} onClick={() => goToPage(result.page - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= result.totalPages}
            onClick={() => goToPage(result.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}