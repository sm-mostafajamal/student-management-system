import { StudentStatus } from "@prisma/client";

// Pure data, no Prisma/DB imports — safe to import from client components.
export const ALLOWED_TRANSITIONS: Record<StudentStatus, StudentStatus[]> = {
  [StudentStatus.ENROLLED]: [StudentStatus.DEFERRED, StudentStatus.WITHDRAWN, StudentStatus.COMPLETED],
  [StudentStatus.DEFERRED]: [StudentStatus.ENROLLED, StudentStatus.WITHDRAWN],
  [StudentStatus.WITHDRAWN]: [],
  [StudentStatus.COMPLETED]: [],
};

export function getAllowedNextStatuses(current: StudentStatus): StudentStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}