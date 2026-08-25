"use client";

import { SourcePdfSlideover } from "@/features/sources/slideovers/source-pdf-slideover";
import type { SourceDTO } from "@/features/sources/types";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useEffect, useState } from "react";

interface SourcePdfPanelProps {
  source: SourceDTO;
}

export function SourcePdfPanel({ source }: SourcePdfPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCitationId, setPendingCitationId] = useState<number | null>(null);

  useKeyboardShortcut(() => setIsOpen(true), { key: "p" });

  useEffect(() => {
    const handlePdfOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ sourceId: number; citationId: number }>).detail;
      if (!detail || detail.sourceId !== source.id) return;
      setPendingCitationId(detail.citationId);
      setIsOpen(true);
    };

    window.addEventListener("pdf:open", handlePdfOpen as EventListener);
    return () => window.removeEventListener("pdf:open", handlePdfOpen as EventListener);
  }, [source.id]);

  if (source.type !== "pdf") return null;

  return (
    <>
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40">
        <button
          type="button"
          className="rounded-l-lg border border-border bg-background/90 px-3 py-2 text-sm font-medium shadow-lg hover:bg-background"
          onClick={() => setIsOpen(true)}
        >
          PDF <span className="ml-1 text-xs text-muted-foreground">[P]</span>
        </button>
      </div>

      <SourcePdfSlideover
        sourceId={source.id}
        isPanelOpen={isOpen}
        onPanelOpenChange={setIsOpen}
        scrollToCitationId={pendingCitationId}
      />
    </>
  );
}
