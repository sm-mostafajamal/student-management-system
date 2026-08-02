-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_admissionAcademicYearId_fkey" FOREIGN KEY ("admissionAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
