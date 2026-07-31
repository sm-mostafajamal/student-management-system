# PEN Global — Student Management System (Registry Module)

A focused Registry web app covering the four workflows a Registry Administrator uses
daily: student enrollment, fees & payments, assessment submission, and marksheets/results.

Checkout the website: https://student-management-system-eosin-three.vercel.app 
## Overview

Built as a technical assessment response, not a full platform. The data model is
intentionally richer than the brief's minimum (academic years, course offerings,
fee structures vs. snapshotted fees, grade audit logs) because those are the exact
places a real Registry team runs into trouble — see **Design Decisions & Edge Cases**
below.

## Tech Stack

- **Next.js 15** (App Router, Server Actions)
- **PostgreSQL** + **Prisma ORM**
- **Tailwind CSS** + **shadcn/ui** components
- **Zod** for validation, **react-hook-form** for forms
- Cookie-based role toggle in place of real authentication (see below)

## Prerequisites

- Node.js 18+
- A running PostgreSQL instance (local, Docker, or hosted)

## Local Setup

Run these in order:

```bash
# 1. Clone
git clone https://github.com/sm-mostafajamal/student-management-system.git
cd student-management-system

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# then edit .env and set DATABASE_URL to point at your Postgres instance

# 4. Create the database schema
npm run db:migrate

# 5. Load demo data (students, programmes, fees, submissions, grades)
npm run db:seed

# 6. Start the dev server
npm run dev
```

Open **http://localhost:3000**.

Other useful scripts:

```bash
npm run db:studio   # browse the DB in Prisma Studio
npm run db:reset    # drop, re-migrate, and re-seed in one step
npm run type-check  # tsc --noEmit
npm run build        # prisma generate + next build
```
## Environment Variables
 
Copy `.env.example` to `.env` and fill in:
 
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma (`prisma/schema.prisma` → `datasource db`). The app will not boot or migrate without it. e.g. `postgresql://user:password@localhost:5432/sms_db` |
| `NODE_ENV` | No | Set automatically by the Next.js CLI (`dev`/`build`/`start`) — you don't need to set this yourself. Only listed because `src/lib/prisma.ts` and `src/app/api/role/route.ts` branch on it (query logging in dev, secure cookies in prod). |
| `UPLOAD_DIR` | No | Optional override for where assessment submission files are written. Defaults to a local `./uploads` folder derived from `process.cwd()` in `src/lib/file-storage.ts`. No storage credentials or bucket config are required for the demo. |
 
No other environment variables are read anywhere in the codebase — never commit a real `.env`, only `.env.example`.

## Demo Accounts / Role Toggle

There's no real authentication — per the assessment's "auth optional" allowance,
the landing page lets you pick **Staff** or **Student**. Picking a role calls
`POST /api/role`, which finds the first active seeded user with that role and
stores it in an HTTP-only cookie (`sms_role`, `sms_user`). All pages and Server
Actions read the active role from that cookie.

You must run `npm run db:seed` first, or the role picker will return
"No active STAFF/STUDENT user found."

Seeded staff (Registry Admin + two lecturers) and 6 seeded students covering every
`StudentStatus` (Active ×3, Suspended, Deferred, Graduated) are created by
`prisma/seed.ts` — see the console output after seeding for the full list, or
browse `User`/`Student` in Prisma Studio.

## Project Structure

```
prisma/                  schema.prisma, migrations, seed.ts
src/
  app/
    (staff)/              Staff-only routes: students, programmes, courses,
                           course-offerings, enrollments, fees, payments,
                           assessments, grades
    (student)/             Student-only routes: my-courses, my-fees, results
    api/                    role toggle + submission file download route
  actions/, app/actions/  Server Actions (form mutations)
  services/               Business logic — fee, payment, submission, result, etc.
  server/queries/         Read-only query helpers used by pages
  lib/                    prisma client, role/session helpers, file storage, validation
  components/             UI components, grouped by feature + shadcn/ui primitives (components/ui)
```

## Design Decisions & Edge Cases Handled

Pulled from the actual service-layer comments (not restated from scratch), since that's
where the reasoning lives:

**Fees & Payments** (`src/services/fee.service.ts`)
- `Fee.amountDue` is a **snapshot** taken at billing time — later changes to a
  `FeeStructure` template never retroactively alter an already-issued fee.
- A fee's balance is **always computed** as `amountDue − waived − SUM(completed payments)`,
  never trusted from a cached column alone, so the Fee row and its Payments can't drift apart.
- Payment reversal sets `status = REVERSED`; nothing is ever deleted, keeping the
  financial audit trail immutable.
- `Payment.reference` is an idempotency key enforced at the DB constraint level —
  double-submitted payments are rejected before any money logic runs.
- Billing a whole programme uses `allSettled` so one bad student record doesn't block
  billing the rest of the cohort.
- The overdue dashboard query and count are computed in raw, parameterized SQL directly
  from `dueDate` + live payment totals (not the cached `status` column), so a fee that
  lapses is flagged immediately rather than waiting for an unrelated event to resync it.

**Assessment Submission** (`src/services/submission.service.ts`)
- A student must be **enrolled** in the course offering an assessment belongs to —
  otherwise anyone could submit against any assessment by guessing IDs.
- The file is validated (size, and actual magic-byte signature vs. claimed extension —
  not just the filename) and written to disk *before* any DB transaction starts.
- Lateness is decided **after** the upload completes, inside a `SERIALIZABLE`
  transaction that re-reads the deadline fresh — this is the fix for a deadline
  ticking over mid-upload: a student is judged by the clock at commit time, not click time.
- Resubmission is allowed up to `maxAttempts`, but only while the deadline + grace
  period hasn't passed; once it has, the prior submission stands as final.
- A unique DB constraint on `(assessmentId, studentId, attemptNumber)` is the last
  line of defense against two concurrent submit requests racing each other.
- Any staff member can view any submission for the demo (per the "simple role toggle"
  constraint) — production would scope this to the assigned instructor or a
  registrar/admin override.

**Marksheet & Results** (`src/services/result.service.ts`)
- Grades are always created **unpublished**; staff must explicitly publish.
- Editing an **already-published** grade requires a reason and auto-unpublishes it —
  a corrected score is never visible to the student until staff re-confirms via publish.
- Concurrent grade edits are caught with optimistic locking (`id` + `version` in the
  `WHERE` clause) rather than silently overwritten.
- Publish/unpublish are **idempotent** — re-clicking doesn't throw, it's a no-op.
- A student requesting an unpublished result and a student requesting a result that
  doesn't exist yet get the **same response** — the distinction isn't observable from
  the student side.

## AI Usage

AI (Claude) was used throughout the build, primarily for:

- **Scaffolding boilerplate**: Prisma schema first drafts, shadcn/ui component wiring,
  and repetitive CRUD Server Action patterns, all reviewed and adjusted by hand
  afterward (e.g. tightening validation schemas, fixing relation names).
- **Surfacing edge cases**: talking through each of the four workflows with AI to list
  out what a real Registry team would hit (overdue balances, late submissions,
  withheld results, concurrent grade edits) before writing the service layer — the
  edge cases above were implemented deliberately, not generated blind.
- **Code review pass**: after the initial build, used AI to re-read the repo end to
  end looking for anything broken or missing before submission. It caught a real bug —
  `src/lib/auth-helpers.ts` imported from a non-existent `@/auth` module, which broke
  the Programmes/Courses/Course Offerings routes — along with the missing
  `.env.example` and this README being unedited `create-next-app` boilerplate.

Everything AI-suggested was read and verified against the actual schema and running
behavior before being kept — nothing was committed unread.