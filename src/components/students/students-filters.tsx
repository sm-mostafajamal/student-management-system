"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { StudentStatus } from "@/types";

interface ProgrammeOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export function StudentsFilters({ programmes }: { programmes: ProgrammeOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page"); // any filter change resets pagination
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams]
  );

  // Debounce free-text search so we don't refetch on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== (searchParams.get("search") ?? "")) updateParam("search", search || null);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, ID, or email…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Select
        value={searchParams.get("programmeId") ?? "all"}
        onValueChange={(v) => updateParam("programmeId", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All programmes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All programmes</SelectItem>
          {programmes.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.code} — {p.name}
              {!p.isActive ? " (inactive)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => updateParam("status", v === "all" ? null : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.values(StudentStatus).map((s) => (
            <SelectItem key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}