/**
 * Root layout — Server Component.
 *
 * Responsibilities:
 * 1. Sets the <html> and <body> with font + theme class hooks.
 * 2. Reads the session cookie on the server and passes it as the initial
 *    value for <SessionProvider> — eliminates client-side loading flash.
 * 3. Mounts ThemeProvider (client) and SessionProvider (client) as high as
 *    possible so every child has access.
 * 4. Wraps the page in <AppShell> (sidebar + main column).
 *
 * The layout is NOT role-specific — role-specific routing lives in the
 * (staff) and (student) route groups. The layout simply renders whatever
 * children Next.js passes in.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/shared/theme-provider";
import { SessionProvider } from "@/components/shared/session-provider";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/role";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PEN Global — Student Registry",
    template: "%s | PEN Global Registry",
  },
  description: "Student Information System — Registry Module",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const sessionUser = await getSessionUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SessionProvider initialUser={sessionUser}>
            {sessionUser ? (
              <AppShell>{children}</AppShell>
            ) : (
              <>{children}</>
            )}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}