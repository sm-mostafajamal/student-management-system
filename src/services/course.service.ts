/**
 * Course Service
 *
 * WHY separate from programme.service.ts:
 *   Course and CourseOffering writes are structurally different (courses belong
 *   to programmes; offerings involve users and academic years). Keeping them in
 *   one file would make it ~400+ lines. Two focused files are easier to test
 *   and reason about individually.
 *
 * EDGE CASES HANDLED:
 *   1. Duplicate course code → same P2002 pattern as Programme.
 *   2. Offering duplicates @@unique([courseId, academicYearId, semester]) →
 *      caught at DB level, surfaced as a typed ServiceError with a clear
 *      human-readable message (not "Unique constraint failed").
 *   3. Instructor must be a STAFF or ADMIN user → validated before the INSERT
 *      so we can give a specific error ("John Doe is a student, not staff").
 *   4. Capacity reduction below current enrollment → blocked to prevent the
 *      offering going over capacity silently.
 */

import { prisma } from "@/lib/prisma";
import type { CreateCourseInput, UpdateCourseInput, CreateOfferingInput, UpdateOfferingInput } from "@/lib/validations/programme-course";
import { Prisma } from "@prisma/client";
import { ServiceError } from "./programme.service";

// CourseOffering has no `isActive` column in the schema — only `deletedAt`.
// The UI (offering-form.tsx, courses/[id]/page.tsx) reads/writes `isActive`
// as if it were a real field, so every read path attaches this derived value.
function withIsActive<T extends { deletedAt: Date | null }>(
  offering: T
): T & { isActive: boolean } {
  return { ...offering, isActive: offering.deletedAt === null };
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function getCourseById(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      programme: { select: { id: true, code: true, name: true } },
      offerings: {
        orderBy: [{ academicYear: { startDate: "desc" } }, { semester: "asc" }],
        include: {
          academicYear: true,
          instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { enrollments: true } },
        },
      },
    },
  });
  if (!course) return course;
  return { ...course, offerings: course.offerings.map(withIsActive) };
}

export async function listCourses(opts?: {
  programmeId?: string;
  includeInactive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const { programmeId, includeInactive = false, search, page = 1, pageSize = 20 } = opts ?? {};

  const where: Prisma.CourseWhereInput = {
    ...(!includeInactive && { isActive: true }),
    ...(programmeId && { programmeId }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      orderBy: [{ programme: { code: "asc" } }, { code: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        programme: { select: { id: true, code: true, name: true } },
        _count: { select: { offerings: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function createCourse(input: CreateCourseInput) {
  // Verify the programme exists and is active before creating a course under it
  const programme = await prisma.programme.findUnique({
    where: { id: input.programmeId },
    select: { id: true, isActive: true, name: true },
  });
  if (!programme) {
    throw new ServiceError("Programme not found.", "NOT_FOUND", "programmeId");
  }
  if (!programme.isActive) {
    throw new ServiceError(
      "Cannot add a course to an inactive programme. Reactivate the programme first.",
      "VALIDATION",
      "programmeId"
    );
  }

  try {
    return await prisma.course.create({ data: input });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        `A course with code "${input.code}" already exists.`,
        "DUPLICATE_CODE",
        "code"
      );
    }
    throw err;
  }
}

export async function updateCourse(input: UpdateCourseInput) {
  const { id, isActive, ...data } = input;

  try {
    return await prisma.course.update({
      where: { id },
      data: { ...data, isActive },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ServiceError(
        `A course with code "${data.code}" already exists.`,
        "DUPLICATE_CODE",
        "code"
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ServiceError("Course not found.", "NOT_FOUND");
    }
    throw err;
  }
}

// ─── Course Offerings ─────────────────────────────────────────────────────────

export async function getOfferingById(id: string) {
  const offering = await prisma.courseOffering.findUnique({
    where: { id },
    include: {
      course: {
        include: { programme: { select: { id: true, code: true, name: true } } },
      },
      academicYear: true,
      instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { enrollments: true } },
    },
  });
  if (!offering) return offering;
  return withIsActive(offering);
}

export async function listOfferings(opts?: {
  courseId?: string;
  academicYearId?: string;
  instructorId?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const {
    courseId,
    academicYearId,
    instructorId,
    includeInactive = false,
    page = 1,
    pageSize = 20,
  } = opts ?? {};

  const where: Prisma.CourseOfferingWhereInput = {
    ...(!includeInactive && { deletedAt: null }),
    ...(courseId && { courseId }),
    ...(academicYearId && { academicYearId }),
    ...(instructorId && { instructorId }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.courseOffering.findMany({
      where,
      orderBy: [{ academicYear: { startDate: "desc" } }, { semester: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            programme: { select: { code: true, name: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.courseOffering.count({ where }),
  ]);

  return {
    items: items.map(withIsActive),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function createOffering(input: CreateOfferingInput) {
  // Edge-case 1: Instructor must be STAFF or ADMIN, never a student
  const instructor = await prisma.user.findUnique({
    where: { id: input.instructorId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  if (!instructor) {
    throw new ServiceError("Instructor not found.", "NOT_FOUND", "instructorId");
  }
  if (instructor.role === "STUDENT") {
    throw new ServiceError(
      `"${instructor.firstName} ${instructor.lastName}" is a student, not a staff member. Only STAFF or ADMIN users can be assigned as instructors.`,
      "VALIDATION",
      "instructorId"
    );
  }

  // Edge-case 2: Course must be active
  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, isActive: true, code: true },
  });
  if (!course) {
    throw new ServiceError("Course not found.", "NOT_FOUND", "courseId");
  }
  if (!course.isActive) {
    throw new ServiceError(
      `Course "${course.code}" is inactive. Reactivate it before creating an offering.`,
      "VALIDATION",
      "courseId"
    );
  }

  try {
    return await prisma.courseOffering.create({
      data: {
        course: { connect: { id: input.courseId } },
        academicYear: { connect: { id: input.academicYearId } },
        semester: input.semester,
        instructor: { connect: { id: input.instructorId } },
        capacity: input.capacity,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // The @@unique([courseId, academicYearId, semester]) constraint fired
      throw new ServiceError(
        `An offering for this course already exists in the selected academic year and semester. ` +
          "Only one offering per course per semester per year is allowed.",
        "DUPLICATE_CODE" // reuse code; caller checks .code not .message
      );
    }
    throw err;
  }
}


export async function updateOffering(input: UpdateOfferingInput) {
  const { id, instructorId, capacity, isActive } = input;

  // Validate instructor role
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  if (!instructor) {
    throw new ServiceError("Instructor not found.", "NOT_FOUND", "instructorId");
  }
  if (instructor?.role === "STUDENT") {
    throw new ServiceError(
      `"${instructor.firstName} ${instructor.lastName}" is a student, not a staff member.`,
      "VALIDATION",
      "instructorId"
    );
  }

  // Edge-case: prevent reducing capacity below current enrollment
  const offering = await prisma.courseOffering.findUnique({
    where: { id },
    select: {
      _count: { select: { enrollments: { where: { status: "ENROLLED" } } } },
    },
  });
  if (!offering) {
    throw new ServiceError("Offering not found.", "NOT_FOUND");
  }
  const enrolledCount = offering._count.enrollments;
  if (capacity < enrolledCount) {
    throw new ServiceError(
      `Cannot reduce capacity to ${capacity} — ${enrolledCount} student(s) are already enrolled in this offering.`,
      "VALIDATION",
      "capacity"
    );
  }

  try {
    return await prisma.courseOffering.update({
      where: { id },
      data: {
        instructor: { connect: { id: instructorId } },
        capacity,
        deletedAt: isActive ? null : new Date(),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new ServiceError("Offering not found.", "NOT_FOUND");
    }
    throw err;
  }
}