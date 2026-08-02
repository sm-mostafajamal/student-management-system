// Realistic Registry demo data. Run with: npx prisma db seed
//
// Five financial scenarios demonstrated:
//   1. Chidinma  — fully paid (programme fee + 2 course fees, all settled)
//   2. Samuel    — partially paid (programme fee settled, one course fee still outstanding)
//   3. Fatima    — 30+ days overdue (bounced cheque, suspended; overdue > 30 days)
//   4. John      — overpaid / credit (paid more than the programme fee — negative balance)
//   5. Amara     — enrolled, no billable courses yet (programme fee due, no course fees)
//
// Other students cover the non-fee edge cases from the original seed
// (COMPLETED, DEFERRED, SUSPENDED, various submission/grade scenarios).

import {
  PrismaClient,
  Role,
  ProgrammeLevel,
  StudentStatus,
  Gender,
  Semester,
  EnrollmentStatus,
  FeeCategory,
  FeeStatus,
  PaymentMethod,
  PaymentStatus,
  AssessmentType,
  SubmissionStatus,
  LetterGrade,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding PEN Global Registry database...\n");

  // Wipe in FK-safe order (children before parents) so this script is
  // repeatable during development without manual DB resets.
  await prisma.gradeChangeLog.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.user.deleteMany();
  await prisma.academicYear.deleteMany();

  // ── Academic Years ─────────────────────────────────────────────
  const ay2024 = await prisma.academicYear.create({
    data: {
      name: "2024/2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
      isCurrent: false,
    },
  });

  const ay2025 = await prisma.academicYear.create({
    data: {
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: true,
    },
  });

  console.log("✅ Academic years created");

  // ── Staff Users ─────────────────────────────────────────────────
  const registrar = await prisma.user.create({
    data: {
      email: "registrar@pen.edu.ng",
      firstName: "Adaeze",
      lastName: "Bello",
      role: Role.STAFF,
    },
  });

  const lecturerOkon = await prisma.user.create({
    data: {
      email: "g.okon@pen.edu.ng",
      firstName: "Grace",
      lastName: "Okon",
      role: Role.STAFF,
    },
  });

  const lecturerAfolabi = await prisma.user.create({
    data: {
      email: "t.afolabi@pen.edu.ng",
      firstName: "Tunde",
      lastName: "Afolabi",
      role: Role.STAFF,
    },
  });

  console.log("✅ Staff users created");

  // ── Programmes ──────────────────────────────────────────────────
  // baseFee: billed once per student on admission as a PROGRAMME_FEE Fee.
  const progCS = await prisma.programme.create({
    data: {
      code: "BSC-CS",
      name: "BSc Computer Science",
      level: ProgrammeLevel.UNDERGRADUATE,
      durationYears: 4,
      departmentName: "Computer Science",
      baseFee: 50000, // ₦50,000 — billed once at admission
    },
  });

  const progBA = await prisma.programme.create({
    data: {
      code: "BSC-BA",
      name: "BSc Business Administration",
      level: ProgrammeLevel.UNDERGRADUATE,
      durationYears: 4,
      departmentName: "Business Administration",
      baseFee: 45000, // ₦45,000 — billed once at admission
    },
  });

  console.log("✅ Programmes created (with baseFee)");

  // ── Courses ────────────────────────────────────────────────────
  // courseFee: billed per Enrollment as a COURSE_FEE Fee. GEN100 is free
  // (courseFee = 0) — proves the 0-fee skip path in assignCourseFeeForEnrollment.
  const courseCS201 = await prisma.course.create({
    data: { code: "CS201", title: "Data Structures & Algorithms", creditHours: 3, programmeId: progCS.id, courseFee: 15000 },
  });
  const courseCS205 = await prisma.course.create({
    data: { code: "CS205", title: "Database Systems", creditHours: 3, programmeId: progCS.id, courseFee: 20000 },
  });
  const courseBA101 = await prisma.course.create({
    data: { code: "BA101", title: "Principles of Management", creditHours: 3, programmeId: progBA.id, courseFee: 12000 },
  });
  const courseBA150 = await prisma.course.create({
    data: { code: "BA150", title: "Financial Accounting", creditHours: 3, programmeId: progBA.id, courseFee: 12000 },
  });
  // Cross-programme course, no extra fee — programmeId nullable by design.
  const courseGEN100 = await prisma.course.create({
    data: { code: "GEN100", title: "Communication Skills", creditHours: 2, programmeId: null, courseFee: 0 },
  });

  console.log("✅ Courses created (with courseFee; GEN100 is free)");

  // ── Course Offerings ────────────────────────────────────────────
  const offCS201 = await prisma.courseOffering.create({
    data: { courseId: courseCS201.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerOkon.id, capacity: 40 },
  });
  const offCS205 = await prisma.courseOffering.create({
    data: { courseId: courseCS205.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerOkon.id, capacity: 40 },
  });
  const offBA101 = await prisma.courseOffering.create({
    data: { courseId: courseBA101.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 50 },
  });
  const offGEN100 = await prisma.courseOffering.create({
    data: { courseId: courseGEN100.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 100 },
  });
  const offBA150_2024 = await prisma.courseOffering.create({
    data: { courseId: courseBA150.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 50 },
  });

  console.log("✅ Course offerings created");

  // ── Students ────────────────────────────────────────────────────
  // student1 = Chidinma  → SCENARIO 1: fully paid
  // student2 = Samuel    → SCENARIO 2: partially paid
  // student3 = Fatima    → SCENARIO 3: 30+ days overdue (SUSPENDED)
  // student4 = John      → SCENARIO 4: overpaid/credit (DEFERRED)
  // student5 = Amara     → SCENARIO 5: no billable courses yet (ENROLLED)
  // student6 = Blessing  → COMPLETED (legacy, for grade/history coverage)
  // student7 = Emeka     → ENROLLED (for assessment coverage)

  const user1 = await prisma.user.create({ data: { email: "chidinma.eze@pen.edu.ng", firstName: "Chidinma", lastName: "Eze", role: Role.STUDENT } });
  const student1 = await prisma.student.create({
    data: {
      userId: user1.id, studentNumber: "SMS-2025-0001", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ENROLLED,
      dateOfBirth: new Date("2003-05-14"), gender: Gender.FEMALE, phone: "+2348031234501",
    },
  });

  const user2 = await prisma.user.create({ data: { email: "samuel.danladi@pen.edu.ng", firstName: "Samuel", lastName: "Danladi", role: Role.STUDENT } });
  const student2 = await prisma.student.create({
    data: {
      userId: user2.id, studentNumber: "SMS-2025-0002", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ENROLLED,
      dateOfBirth: new Date("2003-07-07"), gender: Gender.MALE, phone: "+2348031234502",
    },
  });

  const user3 = await prisma.user.create({ data: { email: "fatima.ibrahim@pen.edu.ng", firstName: "Fatima", lastName: "Ibrahim", role: Role.STUDENT } });
  const student3 = await prisma.student.create({
    data: {
      userId: user3.id, studentNumber: "SMS-2024-0015", programmeId: progBA.id,
      admissionAcademicYearId: ay2024.id, status: StudentStatus.ENROLLED,
      dateOfBirth: new Date("2001-08-20"), gender: Gender.FEMALE, phone: "+2348031234503",
    },
  });

  // DEFERRED — paid their programme fee then paid MORE (overpayment/credit).
  const user4 = await prisma.user.create({ data: { email: "john.okafor@pen.edu.ng", firstName: "John", lastName: "Okafor", role: Role.STUDENT } });
  const student4 = await prisma.student.create({
    data: {
      userId: user4.id, studentNumber: "SMS-2024-0016", programmeId: progCS.id,
      admissionAcademicYearId: ay2024.id, status: StudentStatus.DEFERRED,
      dateOfBirth: new Date("2002-01-10"), gender: Gender.MALE, phone: "+2348031234504",
    },
  });

  // ENROLLED — admitted, no course enrolments yet (scenario 5).
  const user5 = await prisma.user.create({ data: { email: "amara.nwosu@pen.edu.ng", firstName: "Amara", lastName: "Nwosu", role: Role.STUDENT } });
  const student5 = await prisma.student.create({
    data: {
      userId: user5.id, studentNumber: "SMS-2025-0003", programmeId: progBA.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ENROLLED,
      dateOfBirth: new Date("2004-02-18"), gender: Gender.FEMALE, phone: "+2348031234505",
    },
  });

  // COMPLETED — legacy admission (admissionAcademicYearId null — proves nullable).
  const user6 = await prisma.user.create({ data: { email: "blessing.umeh@pen.edu.ng", firstName: "Blessing", lastName: "Umeh", role: Role.STUDENT } });
  const student6 = await prisma.student.create({
    data: {
      userId: user6.id, studentNumber: "SMS-2021-0003", programmeId: progBA.id,
      admissionAcademicYearId: null, status: StudentStatus.COMPLETED,
      dateOfBirth: new Date("1999-03-30"), gender: Gender.FEMALE, phone: "+2348031234506",
      expectedGraduationDate: new Date("2025-07-31"),
    },
  });

  // ENROLLED — used for assessment/grade coverage (same as original student2).
  const user7 = await prisma.user.create({ data: { email: "emeka.obi@pen.edu.ng", firstName: "Emeka", lastName: "Obi", role: Role.STUDENT } });
  const student7 = await prisma.student.create({
    data: {
      userId: user7.id, studentNumber: "SMS-2025-0004", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ENROLLED,
      dateOfBirth: new Date("2002-11-02"), gender: Gender.MALE, phone: "+2348031234507",
    },
  });

  console.log("✅ 7 students created (ENROLLED ×3, DEFERRED, SUSPENDED, COMPLETED + 1 extra ENROLLED)");

  // ── Enrollments ─────────────────────────────────────────────────
  // student1 (Chidinma) — CS201 + CS205 + GEN100
  const enr1_CS201 = await prisma.enrollment.create({ data: { studentId: student1.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED } });
  const enr1_CS205 = await prisma.enrollment.create({ data: { studentId: student1.id, courseOfferingId: offCS205.id, status: EnrollmentStatus.ENROLLED } });
  const enr1_GEN100 = await prisma.enrollment.create({ data: { studentId: student1.id, courseOfferingId: offGEN100.id, status: EnrollmentStatus.ENROLLED } });

  // student2 (Samuel) — CS201 + CS205
  const enr2_CS201 = await prisma.enrollment.create({ data: { studentId: student2.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED } });
  const enr2_CS205 = await prisma.enrollment.create({ data: { studentId: student2.id, courseOfferingId: offCS205.id, status: EnrollmentStatus.ENROLLED } });

  // student3 (Fatima/SUSPENDED) — was enrolled in BA101, then DROPPED
  const enr3_BA101 = await prisma.enrollment.create({
    data: {
      studentId: student3.id, courseOfferingId: offBA101.id,
      status: EnrollmentStatus.DROPPED, enrolledAt: new Date("2025-09-05"),
      droppedAt: new Date("2025-10-20"),
    },
  });

  // student5 (Amara) — no enrolments (demonstrates scenario 5: programme fee only)

  // student6 (Blessing/COMPLETED) — finished BA150 in prior year
  const enr6_BA150 = await prisma.enrollment.create({
    data: {
      studentId: student6.id, courseOfferingId: offBA150_2024.id,
      status: EnrollmentStatus.COMPLETED, enrolledAt: new Date("2024-09-10"),
    },
  });

  // student7 (Emeka) — CS201 + GEN100 (for assessment coverage)
  const enr7_CS201 = await prisma.enrollment.create({ data: { studentId: student7.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED } });
  const enr7_GEN100 = await prisma.enrollment.create({ data: { studentId: student7.id, courseOfferingId: offGEN100.id, status: EnrollmentStatus.ENROLLED } });

  console.log("✅ Enrollments created");

  // ── Fee Structures (legacy templates) ──────────────────────────
  // Still used for ad-hoc TUITION/LIBRARY billing separate from the new
  // baseFee/courseFee mechanism. Prior-year structures at lower rates prove
  // snapshotting doesn't drift.
  const fsCS_tuition_2025 = await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amount: 450000 } });
  await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.LIBRARY, amount: 15000 } });
  const fsBA_tuition_2025 = await prisma.feeStructure.create({ data: { programmeId: progBA.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amount: 380000 } });
  await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amount: 420000 } });
  const fsBA_tuition_2024 = await prisma.feeStructure.create({ data: { programmeId: progBA.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amount: 350000 } });

  console.log("✅ Fee structures created");

  // ── Fees ────────────────────────────────────────────────────────
  //
  // SCENARIO 1: Chidinma (student1) — FULLY PAID
  //   Programme fee (50,000) + CS201 course fee (15,000) + CS205 course fee (20,000).
  //   GEN100 has no fee (courseFee=0), so no Fee row for that enrollment.
  //   All three fees paid in full.
  const fee1_prog = await prisma.fee.create({ data: { studentId: student1.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.PROGRAMME_FEE, amountDue: 50000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  const fee1_cs201 = await prisma.fee.create({ data: { studentId: student1.id, enrollmentId: enr1_CS201.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.COURSE_FEE, amountDue: 15000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  const fee1_cs205 = await prisma.fee.create({ data: { studentId: student1.id, enrollmentId: enr1_CS205.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.COURSE_FEE, amountDue: 20000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  // GEN100 has courseFee=0 — no Fee row created (same as assignCourseFeeForEnrollment skipping it)

  // SCENARIO 2: Samuel (student2) — PARTIALLY PAID
  //   Programme fee paid in full. CS201 course fee paid. CS205 course fee still unpaid.
  const fee2_prog = await prisma.fee.create({ data: { studentId: student2.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.PROGRAMME_FEE, amountDue: 50000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  const fee2_cs201 = await prisma.fee.create({ data: { studentId: student2.id, enrollmentId: enr2_CS201.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.COURSE_FEE, amountDue: 15000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  const fee2_cs205 = await prisma.fee.create({ data: { studentId: student2.id, enrollmentId: enr2_CS205.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.COURSE_FEE, amountDue: 20000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-10-15") } });

  // SCENARIO 3: Fatima (student3/SUSPENDED) — 30+ DAYS OVERDUE
  //   Programme fee unpaid with a past due date > 30 days ago. Also has a
  //   COURSE_FEE for the BA101 enrollment (even though she later dropped it —
  //   the fee still survives, as per "historical fees survive after drop").
  //   A REVERSED payment proves the bounced-cheque audit trail.
  //   Due date set far enough back to guarantee > 30 days overdue on any run.
  const fee3_prog = await prisma.fee.create({ data: { studentId: student3.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.PROGRAMME_FEE, amountDue: 45000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-06-30") } });
  const fee3_ba101 = await prisma.fee.create({ data: { studentId: student3.id, enrollmentId: enr3_BA101.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.COURSE_FEE, amountDue: 12000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-06-30") } });

  // SCENARIO 4: John (student4/DEFERRED) — OVERPAID / CREDIT
  //   Programme fee is 50,000. He paid 60,000 — a 10,000 credit (negative balance).
  const fee4_prog = await prisma.fee.create({ data: { studentId: student4.id, academicYearId: ay2024.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.PROGRAMME_FEE, amountDue: 50000, status: FeeStatus.PAID, dueDate: new Date("2024-10-15") } });

  // SCENARIO 5: Amara (student5) — ENROLLED, NO BILLABLE COURSES YET
  //   Only the programme base fee has been billed. No course enrolments means
  //   no COURSE_FEE rows. Outstanding balance = 45,000.
  const fee5_prog = await prisma.fee.create({ data: { studentId: student5.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.PROGRAMME_FEE, amountDue: 45000, status: FeeStatus.PENDING, dueDate: new Date("2026-10-15") } });

  // Blessing (student6/COMPLETED) — historical BA150 tuition fee, fully paid.
  const fee6_tuition = await prisma.fee.create({ data: { studentId: student6.id, feeStructureId: fsBA_tuition_2024.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amountDue: 350000, status: FeeStatus.PAID, dueDate: new Date("2025-02-15") } });

  // student7 (Emeka) — standard tuition, not yet paid (overdue path for dashboard).
  const fee7_tuition = await prisma.fee.create({ data: { studentId: student7.id, feeStructureId: fsCS_tuition_2025.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amountDue: 450000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-10-15") } });

  console.log("✅ Fees created (5 scenarios: fully paid, partial, 30+ days overdue, credit, no billable courses)");

  // ── Payments ─────────────────────────────────────────────────────

  // SCENARIO 1: Chidinma — all three fees paid in full
  await prisma.payment.createMany({
    data: [
      { feeId: fee1_prog.id, studentId: student1.id, reference: "PMT-2025-000001", amount: 50000, method: PaymentMethod.BANK_TRANSFER, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-15"), recordedById: registrar.id },
      { feeId: fee1_cs201.id, studentId: student1.id, reference: "PMT-2025-000002", amount: 15000, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-15"), recordedById: registrar.id },
      { feeId: fee1_cs205.id, studentId: student1.id, reference: "PMT-2025-000003", amount: 20000, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-15"), recordedById: registrar.id },
    ],
  });

  // SCENARIO 2: Samuel — programme fee + CS201 paid; CS205 unpaid (OVERDUE)
  await prisma.payment.createMany({
    data: [
      { feeId: fee2_prog.id, studentId: student2.id, reference: "PMT-2025-000004", amount: 50000, method: PaymentMethod.MOBILE_MONEY, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-20"), recordedById: registrar.id },
      { feeId: fee2_cs201.id, studentId: student2.id, reference: "PMT-2025-000005", amount: 15000, method: PaymentMethod.ONLINE, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-20"), recordedById: registrar.id },
      // FAILED attempt on the CS205 fee — balance still outstanding.
      { feeId: fee2_cs205.id, studentId: student2.id, reference: "PMT-2025-000006", amount: 20000, method: PaymentMethod.CARD, status: PaymentStatus.FAILED, paidAt: new Date("2025-10-01"), recordedById: registrar.id },
    ],
  });

  // SCENARIO 3: Fatima — REVERSED cheque (bounced), so both fees remain overdue.
  await prisma.payment.create({
    data: {
      feeId: fee3_prog.id, studentId: student3.id, reference: "PMT-2025-000007",
      amount: 45000, method: PaymentMethod.CHEQUE, status: PaymentStatus.REVERSED,
      paidAt: new Date("2025-06-20"), recordedById: registrar.id,
      reversedById: registrar.id, reversedAt: new Date("2025-06-28"),
      reversalReason: "Cheque bounced — insufficient funds confirmed by bank",
    },
  });

  // SCENARIO 4: John — OVERPAID by 10,000 (pays 60,000 against a 50,000 fee).
  await prisma.payment.create({
    data: {
      feeId: fee4_prog.id, studentId: student4.id, reference: "PMT-2024-000008",
      amount: 60000, method: PaymentMethod.BANK_TRANSFER, status: PaymentStatus.COMPLETED,
      paidAt: new Date("2024-10-01"), recordedById: registrar.id,
    },
  });

  // SCENARIO 5: Amara — no payments yet.

  // Blessing (student6) — historical tuition fully paid.
  await prisma.payment.create({
    data: {
      feeId: fee6_tuition.id, studentId: student6.id, reference: "PMT-2024-000009",
      amount: 350000, method: PaymentMethod.MOBILE_MONEY, status: PaymentStatus.COMPLETED,
      paidAt: new Date("2025-02-01"), recordedById: registrar.id,
    },
  });

  // Emeka (student7) — FAILED card attempt (no balance reduction).
  await prisma.payment.create({
    data: {
      feeId: fee7_tuition.id, studentId: student7.id, reference: "PMT-2025-000010",
      amount: 450000, method: PaymentMethod.CARD, status: PaymentStatus.FAILED,
      paidAt: new Date("2025-10-01"), recordedById: registrar.id,
    },
  });

  console.log("✅ Payments created (COMPLETED, FAILED, REVERSED, ONLINE method all represented)");

  // ── Assessments ──────────────────────────────────────────────────
  const asmtQuiz1 = await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Quiz 1", type: AssessmentType.QUIZ, weightPercentage: 10, maxScore: 20, dueDate: new Date("2025-10-10T23:59:00Z"), gracePeriodMinutes: 30, maxAttempts: 2, isPublished: true, publishedAt: new Date("2025-10-14") } });
  const asmtMidterm = await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Midterm Exam", type: AssessmentType.MIDTERM, weightPercentage: 30, maxScore: 100, dueDate: new Date("2025-11-05T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-11-10") } });
  await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Final Exam", type: AssessmentType.FINAL_EXAM, weightPercentage: 60, maxScore: 100, dueDate: new Date("2026-01-15T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: false } });

  const asmtAssignment1 = await prisma.assessment.create({ data: { courseOfferingId: offCS205.id, title: "Assignment 1: ER Modeling", type: AssessmentType.ASSIGNMENT, weightPercentage: 20, maxScore: 50, dueDate: new Date("2025-10-20T23:59:00Z"), gracePeriodMinutes: 60, maxAttempts: 2, isPublished: true, publishedAt: new Date("2025-10-25") } });
  await prisma.assessment.create({ data: { courseOfferingId: offCS205.id, title: "Final Project", type: AssessmentType.PROJECT, weightPercentage: 80, maxScore: 100, dueDate: new Date("2026-01-20T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: false } });

  const asmtPresentation = await prisma.assessment.create({ data: { courseOfferingId: offGEN100.id, title: "Group Presentation", type: AssessmentType.PRACTICAL, weightPercentage: 100, maxScore: 100, dueDate: new Date("2025-11-30T23:59:00Z"), gracePeriodMinutes: 15, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-12-02") } });

  const asmtBA150Final = await prisma.assessment.create({ data: { courseOfferingId: offBA150_2024.id, title: "Final Exam", type: AssessmentType.FINAL_EXAM, weightPercentage: 100, maxScore: 100, dueDate: new Date("2025-01-15T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-01-20") } });

  console.log("✅ Assessments created");

  // ── Submissions ──────────────────────────────────────────────────
  await prisma.submission.createMany({
    data: [
      // Quiz 1 — student1 on time, student7 LATE
      { assessmentId: asmtQuiz1.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-10-10T18:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 18, gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-12") },
      { assessmentId: asmtQuiz1.id, studentId: student7.id, attemptNumber: 1, submittedAt: new Date("2025-10-11T09:00:00Z"), isLate: true, status: SubmissionStatus.LATE, score: 12, feedback: "Submitted after the grace period — 2 marks deducted per policy", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-12") },

      // Midterm
      { assessmentId: asmtMidterm.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-11-05T14:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 85, gradedById: lecturerOkon.id, gradedAt: new Date("2025-11-08") },
      { assessmentId: asmtMidterm.id, studentId: student7.id, attemptNumber: 1, submittedAt: new Date("2025-11-05T16:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 60, gradedById: lecturerOkon.id, gradedAt: new Date("2025-11-08") },

      // GEN100 presentation
      { assessmentId: asmtPresentation.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-11-29T10:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 90, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-12-01") },
      { assessmentId: asmtPresentation.id, studentId: student7.id, attemptNumber: 1, submittedAt: new Date("2025-11-30T08:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 70, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-12-01") },

      // CS205 Assignment 1 — student2 LATE
      { assessmentId: asmtAssignment1.id, studentId: student2.id, attemptNumber: 1, submittedAt: new Date("2025-10-21T10:00:00Z"), isLate: true, status: SubmissionStatus.LATE, score: 25, feedback: "Late submission — capped score applied per policy", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-26") },

      // Blessing's historical final exam
      { assessmentId: asmtBA150Final.id, studentId: student6.id, attemptNumber: 1, submittedAt: new Date("2025-01-15T12:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 88, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-01-18") },
    ],
  });

  // CS205 Assignment 1, student1 — RESUBMISSION (maxAttempts=2)
  await prisma.submission.create({ data: { assessmentId: asmtAssignment1.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-10-18T09:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 30, feedback: "Initial submission — ER diagram missing cardinality constraints", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-19") } });
  await prisma.submission.create({ data: { assessmentId: asmtAssignment1.id, studentId: student1.id, attemptNumber: 2, submittedAt: new Date("2025-10-19T20:00:00Z"), isLate: false, status: SubmissionStatus.RESUBMITTED, score: 45, feedback: "Much improved — cardinality now correctly modeled", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-20") } });

  console.log("✅ Submissions created");

  // ── Grades ───────────────────────────────────────────────────────
  await prisma.grade.create({ data: { studentId: student7.id, courseOfferingId: offCS201.id, isPublished: false } });

  const grade1 = await prisma.grade.create({
    data: {
      studentId: student1.id, courseOfferingId: offCS201.id,
      numericScore: 82, letterGrade: LetterGrade.A_MINUS, gpaPoints: 3.7,
      isPublished: true, publishedAt: new Date("2026-01-25"), computedById: registrar.id,
    },
  });

  // Blessing — published, then CORRECTED (grade change log)
  const grade6 = await prisma.grade.create({
    data: {
      studentId: student6.id, courseOfferingId: offBA150_2024.id,
      numericScore: 88, letterGrade: LetterGrade.A, gpaPoints: 4.0,
      isPublished: true, publishedAt: new Date("2025-01-22"), computedById: registrar.id,
    },
  });

  await prisma.gradeChangeLog.create({
    data: {
      gradeId: grade6.id,
      previousNumericScore: 78, previousLetterGrade: LetterGrade.C_PLUS, previousGpaPoints: 2.3,
      newNumericScore: 88, newLetterGrade: LetterGrade.A, newGpaPoints: 4.0,
      reason: "Remark requested by student via Exams Office — transcription error found in original marking sheet, corrected after moderation.",
      changedById: registrar.id, changedAt: new Date("2025-02-10"),
      previousIsPublished: false, newIsPublished: true,
    },
  });

  console.log("✅ Grades created (published, withheld, and one post-publish correction with audit log)");

  console.log("\n🎉 Seed complete.");
  console.log("   Programmes: 2 (baseFee set on both)");
  console.log("   Courses: 5 (courseFee set on 4; GEN100 = 0)");
  console.log("   Students: 7 | Fee scenarios demonstrated:");
  console.log("     1. Chidinma  — FULLY PAID  (prog + 2 course fees)");
  console.log("     2. Samuel    — PARTIALLY PAID  (CS205 course fee outstanding)");
  console.log("     3. Fatima    — 30+ DAYS OVERDUE  (bounced cheque, suspended)");
  console.log("     4. John      — OVERPAID / CREDIT  (paid 60k against 50k fee)");
  console.log("     5. Amara     — NO BILLABLE COURSES YET  (programme fee only)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
