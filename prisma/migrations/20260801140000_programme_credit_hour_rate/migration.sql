-- Adds Programme.creditHourRate — the amount billed per credit hour.
-- When set (> 0), a course's fee for an enrolling student is computed as
-- course.creditHours * creditHourRate for that student's programme,
-- instead of relying solely on the course's flat courseFee. Default 0
-- means "no change" — every existing programme keeps behaving exactly
-- as before until staff opt in by setting a rate.
ALTER TABLE "Programme" ADD COLUMN "creditHourRate" DECIMAL(10,2) NOT NULL DEFAULT 0;