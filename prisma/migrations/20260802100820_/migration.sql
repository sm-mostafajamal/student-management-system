/*
  Warnings:
  - The values [SUSPENDED,EXPELLED] on the enum `StudentStatus` will be removed.
*/

-- AlterEnum: add course-level effect statuses
ALTER TYPE "EnrollmentStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable: new Student workflow metadata columns
ALTER TABLE "Student" ADD COLUMN     "award" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "deferralReason" TEXT,
ADD COLUMN     "deferredAt" TIMESTAMP(3),
ADD COLUMN     "expectedReturnDate" TIMESTAMP(3),
ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

-- CreateTable: StudentStatusHistory (must exist before we alter its columns below)
CREATE TABLE "StudentStatusHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "oldStatus" "StudentStatus",
    "newStatus" "StudentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentStatusHistory_studentId_changedAt_idx" ON "StudentStatusHistory"("studentId", "changedAt");

-- AddForeignKey
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStatusHistory" ADD CONSTRAINT "StudentStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum: shrink StudentStatus to the 4 supported values
-- (table now exists, so these ALTER COLUMN statements are valid)
BEGIN;
CREATE TYPE "StudentStatus_new" AS ENUM ('ENROLLED', 'DEFERRED', 'WITHDRAWN', 'COMPLETED');
ALTER TABLE "Student" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "status" TYPE "StudentStatus_new" USING ("status"::text::"StudentStatus_new");
ALTER TABLE "StudentStatusHistory" ALTER COLUMN "oldStatus" TYPE "StudentStatus_new" USING ("oldStatus"::text::"StudentStatus_new");
ALTER TABLE "StudentStatusHistory" ALTER COLUMN "newStatus" TYPE "StudentStatus_new" USING ("newStatus"::text::"StudentStatus_new");
ALTER TYPE "StudentStatus" RENAME TO "StudentStatus_old";
ALTER TYPE "StudentStatus_new" RENAME TO "StudentStatus";
DROP TYPE "StudentStatus_old";
ALTER TABLE "Student" ALTER COLUMN "status" SET DEFAULT 'ENROLLED';
COMMIT;