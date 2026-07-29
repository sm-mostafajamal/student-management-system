// Realistic Registry demo data. Run with: npx prisma db seed
//
// Design intent: every row exists to demonstrate a specific edge case from
// the schema design (see README §"Hidden edge cases"), not just to fill
// tables. Comments call out which scenario each block proves out.

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
  const progCS = await prisma.programme.create({
    data: {
      code: "BSC-CS",
      name: "BSc Computer Science",
      level: ProgrammeLevel.UNDERGRADUATE,
      durationYears: 4,
      departmentName: "Computer Science",
    },
  });

  const progBA = await prisma.programme.create({
    data: {
      code: "BSC-BA",
      name: "BSc Business Administration",
      level: ProgrammeLevel.UNDERGRADUATE,
      durationYears: 4,
      departmentName: "Business Administration",
    },
  });

  console.log("✅ Programmes created");

  // ── Courses (catalog — permanent, not term-specific) ───────────
  const courseCS201 = await prisma.course.create({
    data: { code: "CS201", title: "Data Structures & Algorithms", creditHours: 3, programmeId: progCS.id },
  });
  const courseCS205 = await prisma.course.create({
    data: { code: "CS205", title: "Database Systems", creditHours: 3, programmeId: progCS.id },
  });
  const courseBA101 = await prisma.course.create({
    data: { code: "BA101", title: "Principles of Management", creditHours: 3, programmeId: progBA.id },
  });
  const courseBA150 = await prisma.course.create({
    data: { code: "BA150", title: "Financial Accounting", creditHours: 3, programmeId: progBA.id },
  });
  // General-education course with NO programme — proves Course.programmeId
  // is legitimately nullable, not an oversight.
  const courseGEN100 = await prisma.course.create({
    data: { code: "GEN100", title: "Communication Skills", creditHours: 2, programmeId: null },
  });

  console.log("✅ Courses created");

  // ── Course Offerings ────────────────────────────────────────────
  // Current term (2025/2026, First Semester)
  const offCS201 = await prisma.courseOffering.create({
    data: { courseId: courseCS201.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerOkon.id, capacity: 40 },
  });
  const offCS205 = await prisma.courseOffering.create({
    data: { courseId: courseCS205.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerOkon.id, capacity: 40 },
  });
  // Offered but nobody enrolled yet — a realistic "just set up" empty state,
  // not a bug in the seed.
  const offBA101 = await prisma.courseOffering.create({
    data: { courseId: courseBA101.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 50 },
  });
  const offGEN100 = await prisma.courseOffering.create({
    data: { courseId: courseGEN100.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 100 },
  });

  // Past, completed offering — used for the GRADUATED student's history.
  const offBA150_2024 = await prisma.courseOffering.create({
    data: { courseId: courseBA150.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, instructorId: lecturerAfolabi.id, capacity: 50 },
  });

  console.log("✅ Course offerings created");

  // ── Students (6 total — covers every StudentStatus that matters) ─
  const user1 = await prisma.user.create({ data: { email: "chidinma.eze@pen.edu.ng", firstName: "Chidinma", lastName: "Eze", role: Role.STUDENT } });
  const student1 = await prisma.student.create({
    data: {
      userId: user1.id, studentNumber: "PEN/2025/00001", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ACTIVE,
      dateOfBirth: new Date("2003-05-14"), gender: Gender.FEMALE, phone: "+2348031234501",
    },
  });

  const user2 = await prisma.user.create({ data: { email: "emeka.obi@pen.edu.ng", firstName: "Emeka", lastName: "Obi", role: Role.STUDENT } });
  const student2 = await prisma.student.create({
    data: {
      userId: user2.id, studentNumber: "PEN/2025/00002", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ACTIVE,
      dateOfBirth: new Date("2002-11-02"), gender: Gender.MALE, phone: "+2348031234502",
    },
  });

  // SUSPENDED — will be tied to an overdue fee + a reversed payment below,
  // so the suspension is explainable from the data, not arbitrary.
  const user3 = await prisma.user.create({ data: { email: "fatima.ibrahim@pen.edu.ng", firstName: "Fatima", lastName: "Ibrahim", role: Role.STUDENT } });
  const student3 = await prisma.student.create({
    data: {
      userId: user3.id, studentNumber: "PEN/2024/00015", programmeId: progBA.id,
      admissionAcademicYearId: ay2024.id, status: StudentStatus.SUSPENDED,
      dateOfBirth: new Date("2001-08-20"), gender: Gender.FEMALE, phone: "+2348031234503",
    },
  });

  // DEFERRED — paid up for their last active term, then paused. No current
  // enrollments — proves the model doesn't force a student into a term.
  const user4 = await prisma.user.create({ data: { email: "john.okafor@pen.edu.ng", firstName: "John", lastName: "Okafor", role: Role.STUDENT } });
  const student4 = await prisma.student.create({
    data: {
      userId: user4.id, studentNumber: "PEN/2024/00016", programmeId: progCS.id,
      admissionAcademicYearId: ay2024.id, status: StudentStatus.DEFERRED,
      dateOfBirth: new Date("2002-01-10"), gender: Gender.MALE, phone: "+2348031234504",
    },
  });

  // GRADUATED — legacy admission (admissionAcademicYearId left null on
  // purpose, proving that field's nullability isn't a design gap).
  const user5 = await prisma.user.create({ data: { email: "blessing.umeh@pen.edu.ng", firstName: "Blessing", lastName: "Umeh", role: Role.STUDENT } });
  const student5 = await prisma.student.create({
    data: {
      userId: user5.id, studentNumber: "PEN/2021/00003", programmeId: progBA.id,
      admissionAcademicYearId: null, status: StudentStatus.GRADUATED,
      dateOfBirth: new Date("1999-03-30"), gender: Gender.FEMALE, phone: "+2348031234505",
      expectedGraduationDate: new Date("2025-07-31"),
    },
  });

  // ACTIVE with a partially paid fee — the "PARTIALLY_PAID" status path.
  const user6 = await prisma.user.create({ data: { email: "samuel.danladi@pen.edu.ng", firstName: "Samuel", lastName: "Danladi", role: Role.STUDENT } });
  const student6 = await prisma.student.create({
    data: {
      userId: user6.id, studentNumber: "PEN/2025/00003", programmeId: progCS.id,
      admissionAcademicYearId: ay2025.id, status: StudentStatus.ACTIVE,
      dateOfBirth: new Date("2003-07-07"), gender: Gender.MALE, phone: "+2348031234506",
    },
  });

  console.log("✅ 6 students created (ACTIVE ×3, SUSPENDED, DEFERRED, GRADUATED)");

  // ── Enrollments ─────────────────────────────────────────────────
  await prisma.enrollment.createMany({
    data: [
      { studentId: student1.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student1.id, courseOfferingId: offCS205.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student1.id, courseOfferingId: offGEN100.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student2.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student2.id, courseOfferingId: offGEN100.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student6.id, courseOfferingId: offCS201.id, status: EnrollmentStatus.ENROLLED },
      { studentId: student6.id, courseOfferingId: offCS205.id, status: EnrollmentStatus.ENROLLED },
    ],
  });

  // Suspended student: was enrolled, then DROPPED — shows history survives
  // a status change instead of being deleted.
  await prisma.enrollment.create({
    data: {
      studentId: student3.id, courseOfferingId: offBA101.id,
      status: EnrollmentStatus.DROPPED, enrolledAt: new Date("2025-09-05"),
      droppedAt: new Date("2025-10-20"),
    },
  });

  // Graduated student: completed their final course in the past term.
  await prisma.enrollment.create({
    data: {
      studentId: student5.id, courseOfferingId: offBA150_2024.id,
      status: EnrollmentStatus.COMPLETED, enrolledAt: new Date("2024-09-10"),
    },
  });

  console.log("✅ Enrollments created");

  // ── Fee Structures (templates) ──────────────────────────────────
  const fsCS_tuition_2025 = await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amount: 450000 } });
  await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.LIBRARY, amount: 15000 } });
  const fsBA_tuition_2025 = await prisma.feeStructure.create({ data: { programmeId: progBA.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amount: 380000 } });

  // Prior-year structures at a DIFFERENT (lower) rate — this is the direct
  // proof that Fee.amountDue snapshots correctly and doesn't drift when
  // FeeStructure changes year over year.
  const fsCS_tuition_2024 = await prisma.feeStructure.create({ data: { programmeId: progCS.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amount: 420000 } });
  const fsBA_tuition_2024 = await prisma.feeStructure.create({ data: { programmeId: progBA.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amount: 350000 } });

  console.log("✅ Fee structures created (note: 2024 tuition ≠ 2025 tuition, by design)");

  // ── Fees (invoiced, snapshotted amounts) ────────────────────────
  const fee1Tuition = await prisma.fee.create({ data: { studentId: student1.id, feeStructureId: fsCS_tuition_2025.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amountDue: 450000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });
  const fee1Library = await prisma.fee.create({ data: { studentId: student1.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.LIBRARY, amountDue: 15000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });

  const fee2Tuition = await prisma.fee.create({ data: { studentId: student2.id, feeStructureId: fsCS_tuition_2025.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amountDue: 450000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-10-15") } });

  // The suspended student's fee — OVERDUE with zero completed payments,
  // which is the actual business reason behind their SUSPENDED status.
  const fee3Tuition = await prisma.fee.create({ data: { studentId: student3.id, feeStructureId: fsBA_tuition_2025.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amountDue: 380000, status: FeeStatus.OVERDUE, dueDate: new Date("2025-10-15") } });

  const fee4Tuition = await prisma.fee.create({ data: { studentId: student4.id, feeStructureId: fsCS_tuition_2024.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amountDue: 420000, status: FeeStatus.PAID, dueDate: new Date("2025-02-15") } });

  const fee5Tuition = await prisma.fee.create({ data: { studentId: student5.id, feeStructureId: fsBA_tuition_2024.id, academicYearId: ay2024.id, semester: Semester.SECOND_SEMESTER, category: FeeCategory.TUITION, amountDue: 350000, status: FeeStatus.PAID, dueDate: new Date("2025-02-15") } });

  const fee6Tuition = await prisma.fee.create({ data: { studentId: student6.id, feeStructureId: fsCS_tuition_2025.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.TUITION, amountDue: 450000, status: FeeStatus.PARTIALLY_PAID, dueDate: new Date("2025-10-15") } });
  const fee6Library = await prisma.fee.create({ data: { studentId: student6.id, academicYearId: ay2025.id, semester: Semester.FIRST_SEMESTER, category: FeeCategory.LIBRARY, amountDue: 15000, status: FeeStatus.PAID, dueDate: new Date("2025-10-15") } });

  console.log("✅ Fees created (PAID, OVERDUE, PARTIALLY_PAID all represented)");

  // ── Payments ─────────────────────────────────────────────────────
  await prisma.payment.createMany({
    data: [
      { feeId: fee1Tuition.id, studentId: student1.id, reference: "PMT-2025-000001", amount: 450000, method: PaymentMethod.BANK_TRANSFER, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-20"), recordedById: registrar.id },
      { feeId: fee1Library.id, studentId: student1.id, reference: "PMT-2025-000002", amount: 15000, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-20"), recordedById: registrar.id },

      // FAILED payment attempt — fee correctly remains OVERDUE afterward.
      { feeId: fee2Tuition.id, studentId: student2.id, reference: "PMT-2025-000003", amount: 450000, method: PaymentMethod.CARD, status: PaymentStatus.FAILED, paidAt: new Date("2025-10-01"), recordedById: registrar.id },

      { feeId: fee4Tuition.id, studentId: student4.id, reference: "PMT-2024-000005", amount: 420000, method: PaymentMethod.BANK_TRANSFER, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-02-01"), recordedById: registrar.id },
      { feeId: fee5Tuition.id, studentId: student5.id, reference: "PMT-2024-000006", amount: 350000, method: PaymentMethod.MOBILE_MONEY, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-02-01"), recordedById: registrar.id },

      // Partial payment — 250,000 of 450,000, leaving a real balance.
      { feeId: fee6Tuition.id, studentId: student6.id, reference: "PMT-2025-000007", amount: 250000, method: PaymentMethod.MOBILE_MONEY, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-25"), recordedById: registrar.id },
      { feeId: fee6Library.id, studentId: student6.id, reference: "PMT-2025-000008", amount: 15000, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, paidAt: new Date("2025-09-25"), recordedById: registrar.id },
    ],
  });

  // REVERSED payment — bounced cheque. Created separately (not via
  // createMany) because it needs the reversal fields populated, and this is
  // the direct explanation for why student3 is both OVERDUE and SUSPENDED —
  // they DID attempt to pay, it just didn't clear.
  await prisma.payment.create({
    data: {
      feeId: fee3Tuition.id, studentId: student3.id, reference: "PMT-2025-000004",
      amount: 380000, method: PaymentMethod.CHEQUE, status: PaymentStatus.REVERSED,
      paidAt: new Date("2025-09-18"), recordedById: registrar.id,
      reversedById: registrar.id, reversedAt: new Date("2025-09-25"),
      reversalReason: "Cheque bounced — insufficient funds confirmed by bank",
    },
  });

  console.log("✅ Payments created (COMPLETED, FAILED, REVERSED all represented)");

  // ── Assessments ──────────────────────────────────────────────────
  const asmtQuiz1 = await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Quiz 1", type: AssessmentType.QUIZ, weightPercentage: 10, maxScore: 20, dueDate: new Date("2025-10-10T23:59:00Z"), gracePeriodMinutes: 30, maxAttempts: 2, isPublished: true, publishedAt: new Date("2025-10-14") } });
  const asmtMidterm = await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Midterm Exam", type: AssessmentType.MIDTERM, weightPercentage: 30, maxScore: 100, dueDate: new Date("2025-11-05T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-11-10") } });
  // Final exam not yet published — students can see CA scores but not this,
  // which is the concrete case for edge case "CA visibility vs final grade".
  const asmtFinal = await prisma.assessment.create({ data: { courseOfferingId: offCS201.id, title: "Final Exam", type: AssessmentType.FINAL_EXAM, weightPercentage: 60, maxScore: 100, dueDate: new Date("2026-01-15T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: false } });

  const asmtAssignment1 = await prisma.assessment.create({ data: { courseOfferingId: offCS205.id, title: "Assignment 1: ER Modeling", type: AssessmentType.ASSIGNMENT, weightPercentage: 20, maxScore: 50, dueDate: new Date("2025-10-20T23:59:00Z"), gracePeriodMinutes: 60, maxAttempts: 2, isPublished: true, publishedAt: new Date("2025-10-25") } });
  await prisma.assessment.create({ data: { courseOfferingId: offCS205.id, title: "Final Project", type: AssessmentType.PROJECT, weightPercentage: 80, maxScore: 100, dueDate: new Date("2026-01-20T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: false } });

  const asmtPresentation = await prisma.assessment.create({ data: { courseOfferingId: offGEN100.id, title: "Group Presentation", type: AssessmentType.PRACTICAL, weightPercentage: 100, maxScore: 100, dueDate: new Date("2025-11-30T23:59:00Z"), gracePeriodMinutes: 15, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-12-02") } });

  const asmtBA150Final = await prisma.assessment.create({ data: { courseOfferingId: offBA150_2024.id, title: "Final Exam", type: AssessmentType.FINAL_EXAM, weightPercentage: 100, maxScore: 100, dueDate: new Date("2025-01-15T23:59:00Z"), gracePeriodMinutes: 0, maxAttempts: 1, isPublished: true, publishedAt: new Date("2025-01-20") } });

  console.log("✅ Assessments created (mix of published/unpublished, single/multi-attempt)");

  // ── Submissions ──────────────────────────────────────────────────
  await prisma.submission.createMany({
    data: [
      // Quiz 1 — student1 on time, student2 LATE, student6 on time
      { assessmentId: asmtQuiz1.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-10-10T18:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 18, gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-12") },
      { assessmentId: asmtQuiz1.id, studentId: student2.id, attemptNumber: 1, submittedAt: new Date("2025-10-11T09:00:00Z"), isLate: true, status: SubmissionStatus.LATE, score: 12, feedback: "Submitted after the grace period — 2 marks deducted per policy", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-12") },
      { assessmentId: asmtQuiz1.id, studentId: student6.id, attemptNumber: 1, submittedAt: new Date("2025-10-10T15:30:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 15, gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-12") },

      // Midterm — on time for everyone who took it
      { assessmentId: asmtMidterm.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-11-05T14:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 85, gradedById: lecturerOkon.id, gradedAt: new Date("2025-11-08") },
      { assessmentId: asmtMidterm.id, studentId: student2.id, attemptNumber: 1, submittedAt: new Date("2025-11-05T16:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 60, gradedById: lecturerOkon.id, gradedAt: new Date("2025-11-08") },

      // GEN100 presentation
      { assessmentId: asmtPresentation.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-11-29T10:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 90, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-12-01") },
      { assessmentId: asmtPresentation.id, studentId: student2.id, attemptNumber: 1, submittedAt: new Date("2025-11-30T08:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 70, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-12-01") },

      // CS205 Assignment 1, student6 — LATE, single attempt used
      { assessmentId: asmtAssignment1.id, studentId: student6.id, attemptNumber: 1, submittedAt: new Date("2025-10-21T10:00:00Z"), isLate: true, status: SubmissionStatus.LATE, score: 25, feedback: "Late submission — capped score applied per policy", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-26") },

      // Graduated student's final exam — published, historic
      { assessmentId: asmtBA150Final.id, studentId: student5.id, attemptNumber: 1, submittedAt: new Date("2025-01-15T12:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 88, gradedById: lecturerAfolabi.id, gradedAt: new Date("2025-01-18") },
    ],
  });

  // CS205 Assignment 1, student1 — demonstrates RESUBMISSION under
  // maxAttempts=2: a genuine first attempt, then an improved resubmission,
  // both preserved as separate rows (not overwritten).
  await prisma.submission.create({
    data: { assessmentId: asmtAssignment1.id, studentId: student1.id, attemptNumber: 1, submittedAt: new Date("2025-10-18T09:00:00Z"), isLate: false, status: SubmissionStatus.SUBMITTED, score: 30, feedback: "Initial submission — ER diagram missing cardinality constraints", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-19") },
  });
  await prisma.submission.create({
    data: { assessmentId: asmtAssignment1.id, studentId: student1.id, attemptNumber: 2, submittedAt: new Date("2025-10-19T20:00:00Z"), isLate: false, status: SubmissionStatus.RESUBMITTED, score: 45, feedback: "Much improved — cardinality now correctly modeled", gradedById: lecturerOkon.id, gradedAt: new Date("2025-10-20") },
  });

  console.log("✅ Submissions created (on-time, late, and multi-attempt all represented)");

  // ── Grades ───────────────────────────────────────────────────────
  // In-progress course (final exam not yet published) — grade intentionally
  // withheld. This is the correct state, not a missing feature.
  await prisma.grade.create({
    data: { studentId: student2.id, courseOfferingId: offCS201.id, isPublished: false },
  });
  await prisma.grade.create({
    data: { studentId: student6.id, courseOfferingId: offCS201.id, isPublished: false },
  });

  const grade1 = await prisma.grade.create({
    data: {
      studentId: student1.id, courseOfferingId: offCS201.id,
      numericScore: 82, letterGrade: LetterGrade.A_MINUS, gpaPoints: 3.7,
      isPublished: true, publishedAt: new Date("2026-01-25"), computedById: registrar.id,
    },
  });

  // Graduated student's final grade — published, then LATER CORRECTED.
  // We create the final (corrected) state and separately log the change,
  // which is exactly the pattern grade.service.ts is expected to follow.
  const grade5 = await prisma.grade.create({
    data: {
      studentId: student5.id, courseOfferingId: offBA150_2024.id,
      numericScore: 88, letterGrade: LetterGrade.A, gpaPoints: 4.0,
      isPublished: true, publishedAt: new Date("2025-01-22"), computedById: registrar.id,
    },
  });

  await prisma.gradeChangeLog.create({
    data: {
      gradeId: grade5.id,
      previousNumericScore: 78, previousLetterGrade: LetterGrade.C_PLUS, previousGpaPoints: 2.3,
      newNumericScore: 88, newLetterGrade: LetterGrade.A, newGpaPoints: 4.0,
      reason: "Remark requested by student via Exams Office — transcription error found in original marking sheet, corrected after moderation.",
      changedById: registrar.id,
      changedAt: new Date("2025-02-10"),
      previousIsPublished: false,   // or true
      newIsPublished: true,         // or false
    },
  });

  console.log("✅ Grades created (published, withheld, and one post-publish correction with audit log)");

  console.log("\n🎉 Seed complete.");
  console.log(`   Programmes: 2 | Students: 6 | Course Offerings: 5`);
  console.log(`   Grade IDs for reference — Chidinma: ${grade1.id}, Blessing (corrected): ${grade5.id}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });