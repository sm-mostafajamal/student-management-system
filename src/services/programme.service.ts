/**
 * Programme Service
 *
 * WHY a separate file instead of adding to reference-data.service.ts:
 *   reference-data.service.ts is explicitly read-only (list functions for
 *   dropdowns/filters). Mixing writes there would break that contract and make
 *   future readers question which functions are "safe" to call in RSC without
 *   worrying about side effects. Write services live here; the read service
 *   stays a pure data-access layer.
 *
 * EDGE CASES HANDLED:
 *   1. Duplicate programme code → caught at DB level (@@unique) and surfaced
 *      as a typed ServiceError so the Server Action can return a field-level
 *      error, not a 500.
 *   2. Deactivating a programme that has active enrolled students → we check
 *      BEFORE the update and refuse with a descriptive error. We intentionally
 *      do NOT silently cascade-deactivate courses/offerings; that requires an
 *      explicit, separate staff action.
 *   3. Reactivating → no guard needed; allowed freely.
 */

import { prisma } from "@/lib/prisma";
import type { CreateProgrammeInput, UpdateProgrammeInput } from "@/lib/validations/programme-course";
import { Prisma } from "@prisma/client";
import { toNumber } from "@/lib/decimal";

// ─── Typed error surface ──────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "DUPLICATE_CODE" | "HAS_ACTIVE_STUDENTS" | "NOT_FOUND" | "VALIDATION",
    public readonly field?: string
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

// Programme.baseFee (and, when courses are included, Course.courseFee) are
// Prisma Decimal values and are not plain-object-serializable, so they can't
// cross the Server Component → Client Component boundary (or a Server
// Action's return value) as-is. Every read/write path below converts them
// to plain numbers before returning.
function serializeProgramme<
  T extends {
    baseFee: Prisma.Decimal;
    creditHourRate: Prisma.Decimal;
    courses?: Array<{ courseFee: Prisma.Decimal }>;
  }
>(programme: T) {
  return {
    ...programme,
    baseFee: toNumber(programme.baseFee)!,
    creditHourRate: toNumber(programme.creditHourRate)!,
    ...(programme.courses && {
      courses: programme.courses.map((c) => ({ ...c, courseFee: toNumber(c.courseFee)! })),
    }),
  };
}

// ─── Read (used by this module's pages — use reference-data.service.ts for
//     dropdown lists, this for full detail views) ──────────────────────────────

export async function getProgrammeById(id: string) {
  const programme = await prisma.programme.findUnique({
    where: { id },
    include: {
      courses: {
        orderBy: { code: "asc" },
        include: {
          _count: { select: { offerings: true } },
        },
      },
      _count: {
        select: { students: { where: { status: "ENROLLED" } } },
      },
    },
  });
  if (!programme) return programme;
  return serializeProgramme(programme);
}

export async function listProgrammes(opts?: {
  includeInactive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { includeInactive = false, search, page = 1, pageSize = 20 } = opts ?? {};

  const where: Prisma.ProgrammeWhereInput = {
    ...(!includeInactive && { isActive: true }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.programme.findMany({
      where,
      orderBy: { code: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            courses: true,
            students: { where: { status: "ENROLLED" } },
          },
        },
      },
    }),
    prisma.programme.count({ where }),
  ]);

  return {
    items: items.map(serializeProgramme),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createProgramme(input: CreateProgrammeInput) {
  try {
    const programme = await prisma.programme.create({ data: input });
    return serializeProgramme(programme);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        `A programme with code "${input.code}" already exists.`,
        "DUPLICATE_CODE",
        "code"
      );
    }
    throw err;
  }
}

export async function updateProgramme(input: UpdateProgrammeInput) {
  const { id, isActive, ...data } = input;

  // Edge-case guard: prevent deactivating if students are actively enrolled
  if (isActive === false) {
    const activeEnrolments = await prisma.student.count({
      where: { programme: { id }, status: "ENROLLED" },
    });
    if (activeEnrolments > 0) {
      throw new ServiceError(
        `Cannot deactivate this programme — ${activeEnrolments} student(s) are currently enrolled. ` +
          "Transfer or graduate all active students first.",
        "HAS_ACTIVE_STUDENTS"
      );
    }
  }

  // Check code uniqueness (excluding self) in case the code is being changed
  try {
    const programme = await prisma.programme.update({
      where: { id },
      data: { ...data, isActive },
    });
    return serializeProgramme(programme);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        `A programme with code "${data.code}" already exists.`,
        "DUPLICATE_CODE",
        "code"
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ServiceError("Programme not found.", "NOT_FOUND");
    }
    throw err;
  }
}

export async function setProgrammeStatus(id: string, isActive: boolean) {
  // Edge-case guard: prevent deactivating if students are actively enrolled
  if (isActive === false) {
    const activeEnrolments = await prisma.student.count({
      where: { programme: { id }, status: "ENROLLED" },
    });
    if (activeEnrolments > 0) {
      throw new ServiceError(
        `Cannot deactivate this programme — ${activeEnrolments} student(s) are currently enrolled. ` +
          "Transfer or graduate all active students first.",
        "HAS_ACTIVE_STUDENTS"
      );
    }
  }

  try {
    const programme = await prisma.programme.update({
      where: { id },
      data: { isActive },
    });
    return serializeProgramme(programme);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ServiceError("Programme not found.", "NOT_FOUND");
    }
    throw err;
  }
}