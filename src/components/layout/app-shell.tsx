"use client";

/**
 * The outer chrome: sidebar + main content column.
 * Used by the root layout; pages slot into the `children` area.
 *
 * Separation of concerns: the shell knows nothing about which page is
 * rendered — it only provides the structural columns.
 */

import { Sidebar } from "./sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}