"use client";

import { useSourceSections } from "@/features/sources/hooks/sections";
import { useSource } from "@/features/sources/hooks/sources";
import type { SourceSectionDTO } from "@/features/sources/types";
import { formatSectionRange } from "@/features/sources/utils/section-ranges";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ChevronRight, FileText, PanelRight } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useSourceSectionsSidebar } from "./store";

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

/**
 * Inline sections panel rendered at the authenticated layout level as a flex sibling
 * to <main>. Pushes the main content instead of overlaying it. Only renders when a
 * source has been registered via `useRegisterSectionsSidebar` and the user has it open.
 */
export function SourceSectionsSidebarHost() {
  const { isOpen, width, activeSourceId, setOpen, setWidth } = useSourceSectionsSidebar();
  const { data: sections = [] } = useSourceSections(activeSourceId ?? undefined);

  const isDraggingRef = useRef(false);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startX - ev.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };

      const cleanup = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", cleanup);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", cleanup);
    },
    [width, setWidth],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, setOpen]);

  if (!isOpen || !activeSourceId || sections.length === 0) return null;

  return (
    <aside
      style={{ width }}
      className="sticky top-0 h-screen hidden lg:flex shrink-0 flex-col border-l border-border bg-background"
    >
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize z-10 hover:bg-border/60 active:bg-border transition-colors"
      />
      <SidebarContent sourceId={activeSourceId} sections={sections} />
    </aside>
  );
}

interface SidebarContentProps {
  sourceId: number;
  sections: SourceSectionDTO[];
}

const SidebarContent = memo(function SidebarContent({
  sourceId,
  sections,
}: SidebarContentProps) {
  const router = useRouter();
  const { data: source } = useSource(sourceId);

  const sorted = useMemo(() => {
    return [...sections].sort((a, b) => {
      const aStart = a.range_start ?? -Infinity;
      const bStart = b.range_start ?? -Infinity;
      return aStart - bStart;
    });
  }, [sections]);

  const isAV = source?.type === "podcast" || source?.type === "video";

  const handleSectionClick = (sectionId: number) => {
    router.push(routes.sourceSection(sourceId, sectionId));
  };

  const handleOpenTranscript = (sectionId: number) => {
    router.push(routes.sourceTranscript(sourceId, { section: sectionId }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] md:h-[68px] shrink-0 items-baseline gap-2 border-b px-4">
        <span className="text-sm font-medium self-center">Sections</span>
        <span className="text-xs text-muted-foreground tabular-nums self-center">
          {sorted.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="flex flex-col gap-1">
          {sorted.map((section, idx) => {
            const rangeLabel = formatSectionRange(
              source,
              section.range_start,
              section.range_end,
            );
            return (
              <div
                key={section.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSectionClick(section.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSectionClick(section.id);
                  }
                }}
                className={cn(
                  "group flex w-full cursor-pointer items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors",
                  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-xs tabular-nums text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium leading-snug">
                      {section.title}
                    </span>
                  </div>
                  {section.subtitle && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {section.subtitle}
                    </p>
                  )}
                  {rangeLabel && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {rangeLabel}
                    </p>
                  )}
                </div>
                {isAV && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenTranscript(section.id);
                    }}
                    aria-label="Open in transcript"
                    title="Open in transcript"
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

interface SourceSectionsSidebarToggleProps {
  sourceId: number;
}

export function SourceSectionsSidebarToggle({
  sourceId,
}: SourceSectionsSidebarToggleProps) {
  const { isOpen, toggle } = useSourceSectionsSidebar();
  const { data: sections = [] } = useSourceSections(sourceId);

  if (sections.length === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? "Close sections sidebar" : "Open sections sidebar"}
      aria-pressed={isOpen}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        isOpen && "bg-muted text-foreground",
      )}
    >
      <PanelRight className="h-4 w-4" />
    </button>
  );
}
