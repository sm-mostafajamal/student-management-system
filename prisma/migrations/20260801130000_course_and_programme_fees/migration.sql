-- Fees & Payments: bill students for what they actually study.
--
-- Adds:
--   * Programme.baseFee  — billed once per student as a snapshotted Fee
--   * Course.courseFee   — billed once per Enrollment as a snapshotted Fee
--   * FeeCategory.PROGRAMME_FEE / COURSE_FEE — new categories for the above
--   * PaymentMethod.ONLINE
--   * Fee.enrollmentId   — links a COURSE_FEE Fee back to the Enrollment
--                          that generated it (nullable, unique: one Fee
--                          per Enrollment, never double-billed)

-- AlterEnum
ALTER TYPE "FeeCategory" ADD VALUE 'PROGRAMME_FEE';
ALTER TYPE "FeeCategory" ADD VALUE 'COURSE_FEE';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN "baseFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "courseFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Fee" ADD COLUMN "enrollmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Fee_enrollmentId_key" ON "Fee"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
