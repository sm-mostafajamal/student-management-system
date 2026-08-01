import { Role } from "@prisma/client";
import { Route } from "next";

export interface NavItem {
  label: string;
  href: Route;
  icon: string; // Lucide icon name — resolved dynamically in Sidebar
  roles: Role[]; // which roles can see this item
  badge?: "beta" | "new"; // optional callout
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Full nav tree. Sections with no visible items for the active role
 * are hidden by the Sidebar component automatically.
 */
export const NAV_CONFIG: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
        roles: [Role.STAFF, Role.STUDENT],
      },
    ],
  },
  {
    title: "Registry",
    items: [
      {
        label: "Students",
        href: "/students",
        icon: "Users",
        roles: [Role.STAFF],
      },
      {
        label: "Programmes",
        href: "/programmes",
        icon: "BookOpen",
        roles: [Role.STAFF],
      },
      {
        label: "Courses",
        href: "/courses",
        icon: "GraduationCap",
        roles: [Role.STAFF],
      },
      {
        label: "Course Offerings",             
        href: "/course-offerings",
        icon: "CalendarDays",
        roles: [Role.STAFF],
      },
      {
        label: "Enrollments",
        href: "/enrollments",
        icon: "ClipboardList",
        roles: [Role.STAFF],
      },
      {
        label: "Fee Management",
        href: "/fees",
        icon: "CreditCard",
        roles: [Role.STAFF],
      },
      {
        label: "Payments",
        href: "/payments",
        icon: "Banknote",
        roles: [Role.STAFF],
      },
    ],
  },
  {
    title: "Academics",
    items: [
      {
        label: "My Courses",
        href: "/my-courses",
        icon: "BookMarked",
        roles: [Role.STUDENT],
      },
      {
        label: "My Grades",
        href: "/results",
        icon: "BarChart2",
        roles: [Role.STUDENT],
      },
      {
        label: "Assessments",
        href: "/assessments",
        icon: "FileText",
        roles: [Role.STAFF],
      },
      {
        label: "Grades",
        href: "/grades",
        icon: "Award",
        roles: [Role.STAFF],
      },
      {
        label: "Transcript",
        href: "/transcript",
        icon: "BarChart2",
        roles: [Role.STAFF],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        label: "My Fees",
        href: "/my-fees",
        icon: "Receipt",
        roles: [Role.STUDENT],
      },
    ],
  },
];

/** Flattens config to items visible for a given role. */
export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_CONFIG.flatMap((section) =>
    section.items.filter((item) => item.roles.includes(role))
  );
}

/** Filters sections — sections with zero visible items are excluded. */
export function getNavSectionsForRole(role: Role): NavSection[] {
  return NAV_CONFIG.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}