"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function StudentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[students] route error:", error);
  }, [error]);

  return (
    <div className="p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn't load students</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between gap-4">
          <span>Something went wrong while loading the registry. This has been logged.</span>
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}