// src/components/assessments/LiveStatusBadge.tsx
"use client";

import { useEffect, useState } from "react";

export function LiveStatusBadge({
  dueDate,
  gracePeriodMinutes,
}: {
  dueDate: string | Date;
  gracePeriodMinutes: number;
}) {
  const deadline = new Date(dueDate).getTime() + gracePeriodMinutes * 60_000;
  const [isOpen, setIsOpen] = useState(() => Date.now() <= deadline);

  useEffect(() => {
    const check = () => setIsOpen(Date.now() <= deadline);
    check();
    // Check every 10s — cheap, and closes within 10s of the real deadline
    // instead of waiting for a manual page refresh.
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span
      className={
        isOpen
          ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {isOpen ? "Open" : "Closed"}
    </span>
  );
}