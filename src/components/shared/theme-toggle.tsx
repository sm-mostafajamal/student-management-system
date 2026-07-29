"use client";

/**
 *
 * Light / dark mode toggle button.
 * Uses next-themes `useTheme` to read and set the current theme.
 *
 * Renders nothing until mounted — prevents hydration mismatch caused by
 * the server not knowing the client's stored theme preference.
 */

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render after hydration to avoid SSR mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-md bg-muted animate-pulse" aria-hidden />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="
        inline-flex h-9 w-9 items-center justify-center rounded-md
        text-muted-foreground hover:text-foreground
        hover:bg-accent transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      "
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}