"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, GraduationCap, ClipboardList,
  BookMarked, BarChart2, FileText, Award, CreditCard, Banknote, Receipt,
  LucideProps,CalendarDays,     
} from "lucide-react";
import { Role } from "@prisma/client";
import { getNavSectionsForRole } from "@/lib/nav-config";
import { useSession } from "@/components/shared/session-provider";
import { cn } from "@/lib/utils";
import { SidebarUserSwitcher } from "./sidebar-user-switcher";

// Maps icon name strings (from nav-config) to Lucide components.
// Open/Closed: add a new icon here without changing any nav rendering logic.

type IconName =
  | "LayoutDashboard" | "Users" | "BookOpen" | "GraduationCap"
  | "ClipboardList" | "BookMarked" | "BarChart2" | "FileText"
  | "Award" | "CreditCard" | "Banknote" | "Receipt" | "CalendarDays"; 

const ICON_MAP: Record<IconName, React.ComponentType<LucideProps>> = {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  ClipboardList,
  BookMarked,
  BarChart2,
  FileText,
  Award,
  CreditCard,
  Banknote,
  Receipt,
  CalendarDays,
};


export function Sidebar() {
  const pathname = usePathname();
  const { user, isStaff, switchRole, isSwitching, signOut } = useSession();

  if (!user) return null;

  const sections = getNavSectionsForRole(user.role);

  return (
    <aside className="
      flex h-full w-64 flex-col
      border-r border-border bg-card
    ">
      {/* Brand — click to return to the landing role-picker (fresh start) */}
      <button
        type="button"
        onClick={() => signOut()}
        className="
          flex h-16 w-full items-center gap-2 px-6 border-b border-border
          text-left hover:bg-accent/50 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
        "
        aria-label="PEN Global — return to start"
      >
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">PEN Global</p>
          <p className="text-xs text-muted-foreground mt-0.5">Registry System</p>
        </div>
      </button>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICON_MAP[item.icon as IconName];
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {item.badge.toUpperCase()}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

    {/* Footer: click your name to switch into another staff/student session */}
      <div className="border-t border-border p-4">
        <SidebarUserSwitcher />
      </div>
    </aside>
  );
}