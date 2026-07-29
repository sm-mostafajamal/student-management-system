// Read-only lookups shared by student forms/filters. If a ProgrammeService
// or AcademicYearService already exists elsewhere in the codebase, merge
// these in rather than duplicating — kept separate here to keep this
// module self-contained per task scope.

import { prisma } from "@/lib/prisma";

export async function listActiveProgrammes() {
  return prisma.programme.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, level: true, isActive: true },
  });
}

// Includes inactive programmes — needed for the filter bar (staff must be
// able to find students who were admitted under a now-discontinued
// programme) and for the edit form (must display the student's current
// programme even if it has since been deactivated).
export async function listProgrammesForFilter() {
  return prisma.programme.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, isActive: true },
  });
}

export async function listAcademicYears() {
  return prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, isCurrent: true, startDate: true },
  });
}