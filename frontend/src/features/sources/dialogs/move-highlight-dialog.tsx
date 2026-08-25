"use client";

import type { BaseDialogProps } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { capturesKeys } from "@/features/captures/keys";
import { sectionsApi } from "@/features/sources/api";
import { useSource } from "@/features/sources/hooks/sources";
import { useSourceSections } from "@/features/sources/hooks/sections";
import { citationsKeys } from "@/features/sources/keys";
import { formatSectionRange } from "@/features/sources/utils/section-ranges";
import type { SourceDTO, SourceSectionDTO } from "@/features/sources/types";
import { cn, truncate } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Quote, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

interface MoveHighlightDialogProps extends BaseDialogProps {
  highlightId: number;
  highlightType: "citation" | "capture";
  sourceId: number;
  currentSectionId?: number;
  highlightText: string;
  highlightLocationLabel?: string | null;
}

const UNSORTED = "unsorted" as const;
type SelectionId = number | typeof UNSORTED;

interface SectionRowData {
  id: SelectionId;
  title: string;
  range: string | null;
  duration: string | null;
}

function formatRangeDuration(
  source: SourceDTO | undefined,
  start?: number,
  end?: number,
): string | null {
  if (start == null || end == null) return null;
  const isTimeBased = source?.type === "video" || source?.type === "podcast";
  if (!isTimeBased) {
    const pages = Math.max(0, Math.round(end - start));
    if (pages === 0) return null;
    return `${pages} page${pages === 1 ? "" : "s"}`;
  }
  const total = Math.max(0, Math.round(end - start));
  if (total === 0) return null;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function toRowData(
  section: SourceSectionDTO,
  source: SourceDTO | undefined,
): SectionRowData {
  return {
    id: section.id,
    title: section.title,
    range: formatSectionRange(source, section.range_start, section.range_end),
    duration: formatRangeDuration(source, section.range_start, section.range_end),
  };
}

export function MoveHighlightDialog({
  open,
  onOpenChange,
  highlightId,
  highlightType,
  sourceId,
  currentSectionId,
  highlightText,
  highlightLocationLabel,
}: MoveHighlightDialogProps) {
  const queryClient = useQueryClient();
  const { data: source } = useSource(sourceId);
  const { data: sections = [] } = useSourceSections(sourceId);

  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<SelectionId | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedId(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const currentRow = React.useMemo<SectionRowData | null>(() => {
    if (currentSectionId == null) {
      return { id: UNSORTED, title: "Unsorted", range: null, duration: null };
    }
    const cur = sections.find((s) => s.id === currentSectionId);
    return cur ? toRowData(cur, source) : null;
  }, [currentSectionId, sections, source]);

  const nearbyRows = React.useMemo<SectionRowData[]>(() => {
    if (currentSectionId == null) return [];
    const idx = sections.findIndex((s) => s.id === currentSectionId);
    if (idx === -1) return [];
    const out: SourceSectionDTO[] = [];
    if (idx > 0) out.push(sections[idx - 1]);
    if (idx < sections.length - 1) out.push(sections[idx + 1]);
    return out.map((s) => toRowData(s, source));
  }, [currentSectionId, sections, source]);

  const allRows = React.useMemo<SectionRowData[]>(() => {
    const nearbyIds = new Set(nearbyRows.map((r) => r.id));
    const items: SectionRowData[] = [];
    // "Unsorted" is the empty-section choice; include it unless that's the current selection.
    if (currentSectionId != null) {
      items.push({ id: UNSORTED, title: "Unsorted", range: null, duration: null });
    }
    for (const section of sections) {
      if (section.id === currentSectionId) continue;
      if (nearbyIds.has(section.id)) continue;
      items.push(toRowData(section, source));
    }
    return items;
  }, [sections, source, currentSectionId, nearbyRows]);

  const matches = React.useCallback(
    (row: SectionRowData) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return row.title.toLowerCase().includes(q);
    },
    [search],
  );

  const filteredNearby = nearbyRows.filter(matches);
  const filteredAll = allRows.filter(matches);
  const hasResults = filteredNearby.length > 0 || filteredAll.length > 0;

  const canSubmit =
    selectedId !== null &&
    !isSubmitting &&
    (selectedId === UNSORTED ? currentSectionId != null : selectedId !== currentSectionId);

  async function handleSubmit() {
    if (selectedId === null) return;
    const targetSectionId = selectedId === UNSORTED ? undefined : selectedId;

    setIsSubmitting(true);
    try {
      await sectionsApi.moveHighlight(sourceId, {
        highlight_id: highlightId,
        highlight_type: highlightType,
        section_id: targetSectionId,
      });

      const cacheKey =
        highlightType === "citation"
          ? citationsKeys.bySource(sourceId)
          : capturesKeys.bySource(sourceId);
      queryClient.setQueryData(cacheKey, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: { id: number }) =>
          item.id === highlightId
            ? { ...item, section_id: targetSectionId ?? null }
            : item,
        );
      });

      toast.success("Highlight moved successfully");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to move highlight:", err);
      toast.error("Failed to move highlight. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Move to section</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose a new section for this {highlightType}.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Left pane — list */}
          <div className="border-b md:border-b-0 md:border-r">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sections..."
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            <ScrollArea className="h-[420px] px-4 pb-4">
              {currentRow && (
                <SectionGroup label="Current section">
                  <SectionRow row={currentRow} selected={false} disabled />
                </SectionGroup>
              )}

              {filteredNearby.length > 0 && (
                <SectionGroup label="Nearby sections">
                  {filteredNearby.map((row) => (
                    <SectionRow
                      key={row.id}
                      row={row}
                      selected={selectedId === row.id}
                      onSelect={() => setSelectedId(row.id)}
                    />
                  ))}
                </SectionGroup>
              )}

              {filteredAll.length > 0 && (
                <SectionGroup label="All sections">
                  {filteredAll.map((row) => (
                    <SectionRow
                      key={row.id}
                      row={row}
                      selected={selectedId === row.id}
                      onSelect={() => setSelectedId(row.id)}
                    />
                  ))}
                </SectionGroup>
              )}

              {!hasResults && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No sections match &ldquo;{search}&rdquo;.
                </p>
              )}
            </ScrollArea>
          </div>

          {/* Right pane — currently moving */}
          <div className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Currently moving
            </p>
            <div className="flex gap-3">
              <Quote className="h-4 w-4 mt-1 text-amber-700 shrink-0" />
              <div className="space-y-2 min-w-0">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  &ldquo;{truncate(highlightText, 280)}&rdquo;
                </p>
                {highlightLocationLabel && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{highlightLocationLabel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Moving..." : "Move to this section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SectionRow({
  row,
  selected,
  disabled,
  onSelect,
}: {
  row: SectionRowData;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const meta = [row.range, row.duration].filter(Boolean).join(" · ");
  const highlighted = selected || disabled;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "w-full flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
        disabled
          ? "bg-primary/10 border-primary/30 cursor-default"
          : selected
            ? "bg-primary/15 border-primary/60"
            : "bg-card hover:bg-muted/40 border-transparent",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{row.title}</p>
        {meta && (
          <p
            className={cn(
              "text-xs mt-0.5 truncate",
              highlighted ? "text-foreground/70" : "text-muted-foreground",
            )}
          >
            {meta}
          </p>
        )}
      </div>
      {disabled ? (
        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      ) : (
        <span
          className={cn(
            "h-4 w-4 rounded-full border shrink-0 mt-0.5",
            selected ? "border-primary bg-primary" : "border-muted-foreground/40",
          )}
        />
      )}
    </button>
  );
}
