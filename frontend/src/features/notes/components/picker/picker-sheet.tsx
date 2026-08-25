"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CitationDTO, SourceDTO } from "@/features/sources/types";
import { SourceList } from "./source-list";
import { CitationList } from "./citation-list";
import { useSource } from "@/features/sources/hooks/sources";

interface PickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (citation: CitationDTO, source: SourceDTO) => void;
  sourceId?: number;
}

export function PickerSheet({ open, onOpenChange, onSelect, sourceId }: PickerSheetProps) {
  const [selectedSource, setSelectedSource] = useState<SourceDTO | null>(null);
  const { data: constrainedSource } = useSource(sourceId ?? 0);
  const effectiveSelectedSource = sourceId ? (constrainedSource ?? null) : selectedSource;

  useEffect(() => {
    if (sourceId) {
      setSelectedSource(null);
    }
  }, [sourceId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !sourceId) setSelectedSource(null);
    onOpenChange(nextOpen);
  };

  const handleCitationSelect = (citation: CitationDTO) => {
    if (!effectiveSelectedSource) return;
    onSelect(citation, effectiveSelectedSource);
    if (!sourceId) {
      setSelectedSource(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[480px] p-0 flex flex-col">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm font-medium">Insert citation</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden flex flex-col">
          {effectiveSelectedSource ? (
            <CitationList
              source={effectiveSelectedSource}
              onBack={sourceId ? undefined : () => setSelectedSource(null)}
              onSelect={handleCitationSelect}
            />
          ) : (
            <SourceList onSelect={setSelectedSource} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
