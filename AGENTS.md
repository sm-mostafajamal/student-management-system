<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Development Guide & Project Documentation

This document serves as the primary developer guide and agent instructions for the **PEN Global — Student Management System (Registry Module)** codebase.

---

## 1. Project Info

- **Project Name:** PEN Global — Student Management System (Registry Module)
- **Repository Directory:** `./student-management-system`
- **Version:** `0.1.0` (Private / Technical Assessment Application)
- **Live Deployment:** [Vercel App](https://student-management-system-eosin-three.vercel.app)
- **Primary Domain:** Higher Education Academic & Financial Registry Management

---

## 2. What It's About

The application is a focused Registry Management Web Application covering the daily operational workflows of a Higher Education Registry Administrator and Student body:

### Core Workflows & Modules:
1. **Student Lifecycle & Enrollment Management:**
   - Student onboarding, profile tracking, status transitions (`ENROLLED`, `SUSPENDED`, `DEFERRED`, `COMPLETED`).
   - Programme enrollment and semester course offering registrations.
2. **Fees & Financial Audit Trail:**
   - Fee structure definitions per programme/course.
   - Issuing fee invoices (`Fee.amountDue` snapshotted at billing time).
   - Payment collection, payment reversals (`status = REVERSED`), fee waivers, and dynamic balance calculations.
   - Idempotency protection using DB constraints on `Payment.reference`.
3. **Assessment Submission & Upload Handling:**
   - Assessment creation per course offering with deadline, max attempts, and grace period rules.
   - File uploads validated by magic-byte content inspection (stored in `./uploads`).
   - Late submissions evaluated inside `SERIALIZABLE` DB transactions post-upload.
4. **Marksheet, Results & Audit Trail:**
   - Grade recording and course result calculation.
   - Two-stage grade publishing (Draft / Unpublished vs. Published).
   - Editing published grades automatically unpublishes results and logs audit reasons.
   - Optimistic concurrency locking (`id` + `version`) on grade edits.

### User Roles:
- **Staff (Registry Admin / Lecturers):** Manage students, courses, programmes, fee assignments, assessment submissions, and grade publishing.
- **Student:** View enrolled courses, fee statements, submit assessment files, and view published grade marksheets.
- **Role Switcher:** Cookie-based role toggle (`sms_role`, `sms_user`) via landing page (`POST /api/role`) using seeded users.

---

## 3. Tech Stack

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **Frontend Core:** React 18, TypeScript 5.9
- **Styling & Components:** Tailwind CSS 3.4, `shadcn/ui` (Radix primitives), Base UI, `lucide-react`, `tw-animate-css`, `sonner` (Toast notifications)
- **Form Management & Validation:** `react-hook-form`, `@hookform/resolvers`, Zod 3.23
- **Database & ORM:** PostgreSQL, Prisma ORM 5.22
- **Runtime & Tooling:** Node.js 18+, `tsx` / `ts-node` for seeds/scripts, ESLint 9

---

## 4. Important Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Executes `prisma generate`, `prisma migrate deploy`, and `next build` |
| `npm run start` | Starts production build server |
| `npm run lint` | Runs ESLint checks across the project |
| `npm run type-check` | Runs TypeScript type checker without emitting output (`tsc --noEmit`) |
| `npm run db:generate` | Generates updated Prisma Client types |
| `npm run db:push` | Pushes Prisma schema changes directly to DB (dev/prototyping) |
| `npm run db:migrate` | Applies database migrations in development (`prisma migrate dev`) |
| `npm run db:seed` | Loads seed data (staff, students, programmes, fees, submissions, grades) |
| `npm run db:reset` | Hard reset: drops DB, re-migrates, and re-seeds database |
| `npm run db:studio` | Opens Prisma Studio web UI for browsing DB tables |

---

## 5. Workflow & Development Conventions

### Architecture Pattern: 3-Tier Layering
1. **Presentation Layer (`src/app/`, `src/components/`):**
   - Staff routes in `src/app/(staff)/`.
   - Student routes in `src/app/(student)/`.
   - UI primitives in `src/components/ui/` and domain-specific components in `src/components/<domain>/`.
2. **Server Actions & Queries (`src/actions/`, `src/app/actions/`, `src/server/queries/`):**
   - Server Actions handle client mutations, validate Zod inputs, authorize via role session, and trigger `revalidatePath`.
   - Read-only data queries are located in `src/server/queries/`.
3. **Business Logic & Service Layer (`src/services/`):**
   - Core domain business logic, fee calculations, file upload validation, and DB transactions.

### Standard Development Flow:
1. **Schema Updates:** Modify `prisma/schema.prisma` -> run `npm run db:migrate` -> update `prisma/seed.ts` if needed.
2. **Input Validation:** Define or update Zod schema under `src/lib/validations/`.
3. **Service Method:** Implement core business rules under `src/services/`.
4. **Server Action:** Expose mutation endpoint under `src/actions/`.
5. **UI Integration:** Build or update UI components under `src/components/` and hook up to route pages in `src/app/`.

---

## 6. Project-Specific Guidelines & Technical Gotchas

- **Role Session Setup:** Seed the database (`npm run db:seed`) before using role toggle features. Role cookies (`sms_role`, `sms_user`) require active database records.
- **Financial Immutability:**
  - `Fee.amountDue` is snapshotted at billing time. Never mutate historic fee amounts on fee structure template edits.
  - Always compute balance dynamically (`amountDue - waived - sum(payments)`).
  - Never delete payment rows; mark reversals as `status = REVERSED`.
  - Pass `Payment.reference` to prevent double-billing via database unique constraints.
- **File Uploads & Assessment Submissions:**
  - Uploaded files are written to `./uploads` (`src/lib/file-storage.ts`).
  - Validate file size and magic-byte signatures (not just filename extension strings).
  - Lateness checks are computed within a `SERIALIZABLE` transaction post-upload.
- **Grade & Marksheet Integrity:**
  - Grades are created as draft (`published = false`).
  - Editing published grades forces `published = false` and requires an audit reason.
  - Enforce optimistic concurrency using `id` + `version` check on grade updates.
- **Next.js 15 Specifics:**
  - Review deprecation notices and breaking changes in Next.js 15 before introducing standard Next.js patterns.
