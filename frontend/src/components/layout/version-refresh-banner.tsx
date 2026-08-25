"use client";

import { useEffect, useState } from "react";
import { RotateCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVersionCheck } from "@/hooks/use-version-check";

export function VersionRefreshBanner() {
  const isStale = useVersionCheck({ intervalMs: 3 * 60 * 1000 });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Reset dismissed state when a new version is detected
    // This is a valid use case for setState in useEffect - we're responding to external state change
    if (isStale) {
      setDismissed(false); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isStale]);

  if (!isStale || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[70] pointer-events-none">
      <div className="w-[320px] rounded-lg border bg-card/95 backdrop-blur-md shadow-lg p-4 pointer-events-auto animate-in slide-in-from-top-2 duration-300">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-full bg-primary/10 text-primary p-1.5">
              <RotateCw className="size-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">
                Update available
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Refresh for latest version
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 -mt-1 -mr-1 hover:bg-muted"
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => window.location.reload()}
        >
          <RotateCw className="size-3.5" />
          Refresh now
        </Button>
      </div>
    </div>
  );
}
