import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ProgrammeForm } from "@/components/programmes/programme-form";
import { requireStaff } from "@/lib/auth-helpers";

export const metadata = { title: "New Programme — Registry" };

export default async function NewProgrammePage() {
  await requireStaff();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/programmes"
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to programmes
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          New Programme
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Programmes group related courses and are the unit students enrol into.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <ProgrammeForm />
      </div>
    </div>
  );
}