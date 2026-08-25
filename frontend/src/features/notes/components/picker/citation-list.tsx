"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useCitationsBySource } from "@/features/sources/hooks/citations";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import type { CitationDTO, SourceDTO } from "@/features/sources/types";

interface CitationListProps {
  source: SourceDTO;
  onBack?: () => void;
  onSelect: (citation: CitationDTO) => void;
}

export function CitationList({ source, onBack, onSelect }: CitationListProps) {
  const { data: citations = [], isLoading } = useCitationsBySource(source.id);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? citations.filter((c) => c.text?.toLowerCase().includes(search.toLowerCase()))
    : citations;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const citation = filtered[activeIndex];
      if (citation) onSelect(citation);
    } else if ((e.key === "Escape" || (e.key === "Backspace" && search === "")) && onBack) {
      e.preventDefault();
      onBack();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
        {onBack ? (
          <button
            type="button"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <SourceIcon type={source.type} className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{source.title}</span>
          </button>
        ) : (
          <>
            <SourceIcon type={source.type} className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium truncate">{source.title}</span>
          </>
        )}
      </div>
      <div className="border-b border-border px-4 py-2">
        <input
          autoFocus
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search citations…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <p className="px-4 py-4 text-xs text-muted-foreground">Loading citations…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground">No citations found</p>
        )}
        {filtered.map((citation, i) => (
          <button
            key={citation.id}
            type="button"
            data-active={i === activeIndex ? "true" : undefined}
            className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 ${
              i === activeIndex ? "bg-muted/60" : ""
            }`}
            onClick={() => onSelect(citation)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <span className="line-clamp-3 text-sm leading-relaxed text-foreground">
              {citation.text}
            </span>
            {citation.speaker && (
              <span className="text-xs text-muted-foreground">— {citation.speaker}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
