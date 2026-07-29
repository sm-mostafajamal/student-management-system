import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
}

export function Pagination({ page, totalPages, total, pageSize, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing <span className="font-medium text-zinc-700 dark:text-zinc-300">{from}–{to}</span>{" "}
        of <span className="font-medium text-zinc-700 dark:text-zinc-300">{total}</span>
      </p>
      <div className="flex gap-1">
        <PaginationLink href={buildHref(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </PaginationLink>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i;
          if (p < 1 || p > totalPages) return null;
          return (
            <PaginationLink key={p} href={buildHref(p)} active={p === page}>
              {p}
            </PaginationLink>
          );
        })}
        <PaginationLink href={buildHref(page + 1)} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  active,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-sm text-zinc-300 dark:text-zinc-600"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors",
        active
          ? "bg-indigo-600 font-semibold text-white"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      )}
    >
      {children}
    </Link>
  );
}