"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollText } from "lucide-react";

interface AutoScrollToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function AutoScrollToggle({ enabled, onToggle }: AutoScrollToggleProps) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 ">
      <Button
        variant={enabled ? "default" : "secondary"}
        size="sm"
        className={cn(
          "shadow-lg rounded-full hover:opacity-100",
          !enabled && "hover:bg-secondary!"
        )}
        onClick={onToggle}
      >
        <ScrollText className="w-4 h-4 mr-2" />
        {enabled ? "Auto-scroll On" : "Enable Auto-scroll"}
        <span className="ml-1 text-xs text-muted-foreground">[A]</span>
      </Button>
    </div>
  );
}
