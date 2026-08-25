"use client";

import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import { useSources } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SourceListProps {
  onSelect: (source: SourceDTO) => void;
}

export function SourceList({ onSelect }: SourceListProps) {
  const { data, isLoading } = useSources();
  const sources = data?.sources ?? [];
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? sources.filter((s) => s.title?.toLowerCase().includes(search.toLowerCase()))
    : sources;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.querySelector<HTMLElement>("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) {
        setActiveIndex(0);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const source = filtered[activeIndex];
      if (source) onSelect(source);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-4 py-2">
        <input
          autoFocus
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search sources…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <p className="px-4 py-4 text-xs text-muted-foreground">Loading sources…</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground">No sources found</p>
        )}
        {filtered.map((source, i) => (
          <button
            key={source.id}
            type="button"
            data-active={i === activeIndex ? "true" : undefined}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 ${i === activeIndex ? "bg-muted/60" : ""
              }`}
            onClick={() => onSelect(source)}
            onMouseEnter={() => setActiveIndex(i)}
          >
            <SourceIcon
              type={source.type}
              className="h-4 w-4 shrink-0 text-muted-foreground"
            />
            <span className="flex-1 truncate text-sm font-medium">{source.title}</span>
            <span className="text-xs text-muted-foreground">{source.citation_count ?? 0}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
