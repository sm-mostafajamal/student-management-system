// Additive seed for the Fees & Payments module. Call seedFeesAndPayments(prisma)
// from your existing prisma/seed.ts AFTER programmes, academic years, and
// students have been seeded — this only reads those, never creates them.
//
// import { seedFeesAndPayments } from "./seed/fees.seed";
// await seedFeesAndPayments(prisma);

import { PrismaClient, Semester, FeeCategory, PaymentMethod } from "@prisma/client";

export async function seedFeesAndPayments(prisma: PrismaClient) {
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!academicYear) {
    console.warn("[fees.seed] No current AcademicYear found — skipping.");
    return;
  }

  const staff = await prisma.user.findFirst({ where: { role: "STAFF" } });
  if (!staff) {
    console.warn("[fees.seed] No STAFF user found — skipping.");
    return;
  }

  const programmes = await prisma.programme.findMany({ where: { isActive: true } });

  // 1. Fee structures — TUITION + LIBRARY per active programme, first semester.
  for (const programme of programmes) {
    await prisma.feeStructure.upsert({
      where: {
        programmeId_academicYearId_semester_category: {
          programmeId: programme.id,
          academicYearId: academicYear.id,
          semester: Semester.FIRST_SEMESTER,
          category: FeeCategory.TUITION,
        },
      },
      update: {},
      create: {
        programmeId: programme.id,
        academicYearId: academicYear.id,
        semester: Semester.FIRST_SEMESTER,
        category: FeeCategory.TUITION,
        amount: 450000, // adjust to PEN Global's actual currency/scale
      },
    });
    await prisma.feeStructure.upsert({
      where: {
        programmeId_academicYearId_semester_category: {
          programmeId: programme.id,
          academicYearId: academicYear.id,
          semester: Semester.FIRST_SEMESTER,
          category: FeeCategory.LIBRARY,
        },
      },
      update: {},
      create: {
        programmeId: programme.id,
        academicYearId: academicYear.id,
        semester: Semester.FIRST_SEMESTER,
        category: FeeCategory.LIBRARY,
        amount: 15000,
      },
    });
  }

  // 2. Bill every ENROLLED student, then vary demo data so the overdue list
  // and balance UI have something realistic to show.
  const students = await prisma.student.findMany({ where: { deletedAt: null, status: "ENROLLED" } });

  for (const [index, student] of students.entries()) {
    const structures = await prisma.feeStructure.findMany({
      where: { programmeId: student.programmeId, academicYearId: academicYear.id, semester: Semester.FIRST_SEMESTER },
    });

    for (const structure of structures) {
      const fee = await prisma.fee.upsert({
        where: { studentId_feeStructureId: { studentId: student.id, feeStructureId: structure.id } },
        update: {},
        create: {
          studentId: student.id,
          feeStructureId: structure.id,
          academicYearId: academicYear.id,
          semester: Semester.FIRST_SEMESTER,
          category: structure.category,
          amountDue: structure.amount,
          dueDate: new Date(academicYear.startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      if (index % 3 === 0) {
        // Every 3rd student: fully paid.
        await prisma.payment.create({
          data: {
            feeId: fee.id,
            studentId: student.id,
            reference: `SEED-${fee.id.slice(0, 8)}-FULL`,
            amount: structure.amount,
            method: PaymentMethod.BANK_TRANSFER,
            paidAt: new Date(),
            recordedById: staff.id,
          },
        });
        await prisma.fee.update({ where: { id: fee.id }, data: { status: "PAID" } });
      } else if (index % 4 === 0) {
        // Every 4th student: partially paid AND overdue (backdated due date).
        const partial = Number(structure.amount) * 0.4;
        await prisma.payment.create({
          data: {
            feeId: fee.id,
            studentId: student.id,
            reference: `SEED-${fee.id.slice(0, 8)}-PARTIAL`,
            amount: partial,
            method: PaymentMethod.CASH,
            paidAt: new Date(),
            recordedById: staff.id,
          },
        });
        await prisma.fee.update({
          where: { id: fee.id },
          data: { status: "OVERDUE", dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        });
      }
    }
  }

  console.log(`[fees.seed] Seeded fee structures and billed ${students.length} students.`);
}