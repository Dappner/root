"use client";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialogs";
import { CreateCaptureDialog } from "@/features/captures/components/create-capture-dialog";
import { EditSectionDialog } from "@/features/sources/dialogs/edit-section-dialog";
import { useSourceSections, useUpdateSection } from "@/features/sources/hooks/sections";
import { CreateTakeawaySuggestionDialog } from "@/features/takeaways/dialogs/create-takeaway-suggestion-dialog";
import { useCreateTakeaway } from "@/features/takeaways/hooks";
import { plainTextToTipTapDoc } from "@/features/takeaways/utils/body-json";
import { cn } from "@/lib/utils";
import { useCreateCitation } from "@/features/sources/hooks/citations";
import { CheckCircle2, FileText, Lightbulb, Loader2, MessageSquare, Mic, RotateCcw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface AssistantSuggestionCardProps {
  suggestion: Record<string, unknown>;
}

export function AssistantSuggestionCard({ suggestion }: AssistantSuggestionCardProps) {
  const [state, setState] = useState<"ready" | "accepted" | "dismissed">("ready");
  const { openDialog } = useDialog();
  const type = typeof suggestion.type === "string" ? suggestion.type : "suggestion";
  const confidence = typeof suggestion.confidence === "string" ? suggestion.confidence : null;
  const isSummary = type === "update_section_summary";
  const isTakeaway = type === "create_takeaway";
  const isCitation = type === "create_citation";
  const isCitationProbe = type === "citation_probe";
  const sourceId = typeof suggestion.source_id === "number" ? suggestion.source_id : null;
  const sectionId = typeof suggestion.section_id === "number" ? suggestion.section_id : null;
  const takeawayTitle = typeof suggestion.title === "string" ? suggestion.title : "";
  const speaker = typeof suggestion.speaker === "string" ? suggestion.speaker : null;
  const context = typeof suggestion.context === "string" ? suggestion.context : null;
  const tStartSec = typeof suggestion.t_start_sec === "number" ? suggestion.t_start_sec : null;
  const tEndSec = typeof suggestion.t_end_sec === "number" ? suggestion.t_end_sec : null;
  const chunkIndex = typeof suggestion.chunk_index === "number" ? suggestion.chunk_index : null;
  const text =
    typeof suggestion.text === "string"
      ? suggestion.text
      : typeof suggestion.summary === "string"
        ? suggestion.summary
        : typeof suggestion.body === "string"
          ? suggestion.body
          : typeof suggestion.citation_text === "string"
            ? suggestion.citation_text
            : "";
  const citationId = typeof suggestion.citation_id === "number" ? suggestion.citation_id : null;
  const citationIds = useMemo(() => toNumberArray(suggestion.citation_ids), [suggestion]);
  const captureIds = useMemo(() => toNumberArray(suggestion.capture_ids), [suggestion]);
  const title = isSummary
    ? "Update section summary"
    : isTakeaway
      ? "Create takeaway"
      : isCitation
        ? "Save as citation"
        : isCitationProbe
          ? "Add comment to quote"
          : "Create comment";
  const Icon = isSummary ? FileText : isTakeaway ? Lightbulb : isCitation ? Mic : MessageSquare;
  const { data: sections = [] } = useSourceSections(sourceId ?? undefined);
  const section = useMemo(
    () => sections.find((item) => item.id === sectionId),
    [sectionId, sections],
  );
  const updateSection = useUpdateSection(sourceId ?? 0, sectionId ?? 0);
  const createTakeaway = useCreateTakeaway();
  const createCitation = useCreateCitation();
  const canAcceptSummary = Boolean(isSummary && sourceId && sectionId && text && section);
  const canAcceptTakeaway = Boolean(isTakeaway && sourceId && takeawayTitle);
  const canAcceptCitation = Boolean(isCitation && sourceId && text);

  const handleAccept = async () => {
    if (isTakeaway) {
      if (!canAcceptTakeaway || !sourceId) {
        toast.error("Takeaway suggestion is missing required data.");
        return;
      }
      try {
        await createTakeaway.mutateAsync({
          sourceId,
          data: {
            title: takeawayTitle,
            body_json: plainTextToTipTapDoc(text),
            citation_ids: citationIds,
            capture_ids: captureIds,
          },
        });
        setState("accepted");
        toast.success("Takeaway created");
      } catch {
        toast.error("Failed to create takeaway");
      }
      return;
    }

    if (isCitation) {
      if (!canAcceptCitation || !sourceId) {
        toast.error("Citation suggestion is missing required data.");
        return;
      }
      try {
        await createCitation.mutateAsync({
          source_id: sourceId,
          text,
          info_type: "quote",
          speaker: speaker ?? undefined,
          context: context ?? undefined,
          ...(tStartSec != null || tEndSec != null
            ? {
                location: {
                  mode: "derived" as const,
                  type: "transcript_v1" as const,
                  transcript: {
                    tStartSec: tStartSec ?? undefined,
                    tEndSec: tEndSec ?? undefined,
                    utteranceStartIdx: chunkIndex ?? 0,
                    utteranceEndIdx: chunkIndex ?? 0,
                  },
                },
              }
            : {}),
        });
        setState("accepted");
        toast.success("Citation saved");
      } catch {
        toast.error("Failed to save citation");
      }
      return;
    }

    if (isCitationProbe) {
      if (!sourceId || !citationId) {
        toast.error("Note suggestion is missing citation data.");
        return;
      }
      openDialog(CreateCaptureDialog, {
        sourceId,
        sourceTitle: typeof suggestion.source_title === "string" ? suggestion.source_title : undefined,
        citationId,
      });
      return;
    }

    if (!isSummary) {
      toast.info("Create note suggestions are not wired yet.");
      return;
    }

    if (!canAcceptSummary || !section) {
      toast.error("Section data is still loading. Try again in a moment.");
      return;
    }

    try {
      await updateSection.mutateAsync({
        title: section.title,
        subtitle: section.subtitle,
        summary: text,
        range_start: section.range_start,
        range_end: section.range_end,
      });
      setState("accepted");
      toast.success("Section summary updated");
    } catch {
      toast.error("Failed to update section summary");
    }
  };

  const handleEdit = () => {
    if (isTakeaway) {
      if (!sourceId) {
        toast.error("Takeaway suggestion is missing a source.");
        return;
      }
      openDialog(CreateTakeawaySuggestionDialog, {
        sourceId,
        title: takeawayTitle,
        body: text,
        citationIds,
        captureIds,
      });
      return;
    }

    if (isCitation) {
      toast.info("Edit the text above before accepting.");
      return;
    }

    if (isCitationProbe) {
      if (!sourceId || !citationId) {
        toast.error("Note suggestion is missing citation data.");
        return;
      }
      openDialog(CreateCaptureDialog, {
        sourceId,
        sourceTitle: typeof suggestion.source_title === "string" ? suggestion.source_title : undefined,
        citationId,
      });
      return;
    }

    if (!isSummary) {
      toast.info("Create note edit is not wired yet.");
      return;
    }

    if (!sourceId || !section) {
      toast.error("Section data is still loading. Try again in a moment.");
      return;
    }

    openDialog(EditSectionDialog, {
      sourceId,
      section: {
        ...section,
        summary: text,
      },
    });
  };

  if (state === "dismissed") {
    return (
      <div className="ml-0 sm:ml-12 animate-in fade-in duration-200 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Suggestion dismissed</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => setState("ready")}>
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "ml-0 sm:ml-12 animate-in fade-in duration-300 rounded-xl border p-3.5 transition-colors",
        state === "accepted"
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              state === "accepted" ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/10 text-primary",
            )}
          >
            {state === "accepted" ? (
              <CheckCircle2 className="h-3.5 w-3.5 animate-in zoom-in duration-200" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {getSubtitle({ state, citationId, citationIds, captureIds })}
              {confidence ? ` · ${confidence} confidence` : ""}
            </div>
          </div>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 text-primary/70" />
      </div>

      {text && (
        <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs leading-relaxed">
          {isTakeaway && takeawayTitle && (
            <div className="mb-1 font-medium text-foreground">{takeawayTitle}</div>
          )}
          {isCitation && (speaker || tStartSec != null) && (
            <div className="mb-1 text-muted-foreground">
              {speaker && <span>{speaker}</span>}
              {speaker && tStartSec != null && <span> · </span>}
              {tStartSec != null && (
                <span className="font-mono">
                  {Math.floor(tStartSec / 60)}:{String(Math.floor(tStartSec % 60)).padStart(2, "0")}
                  {tEndSec != null && ` – ${Math.floor(tEndSec / 60)}:${String(Math.floor(tEndSec % 60)).padStart(2, "0")}`}
                </span>
              )}
            </div>
          )}
          {text}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={updateSection.isPending || createTakeaway.isPending || createCitation.isPending || state === "accepted"}
          onClick={() => setState("dismissed")}
        >
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateSection.isPending || createTakeaway.isPending || createCitation.isPending || state === "accepted"}
          onClick={handleEdit}
        >
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={updateSection.isPending || createTakeaway.isPending || createCitation.isPending || state === "accepted"}
          onClick={handleAccept}
        >
          {updateSection.isPending || createTakeaway.isPending || createCitation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "accepted" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : null}
          {state === "accepted" ? "Accepted" : "Accept"}
        </Button>
      </div>
    </div>
  );
}

function toNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function getSubtitle({
  state,
  citationId,
  citationIds,
  captureIds,
}: {
  state: "ready" | "accepted" | "dismissed";
  citationId: number | null;
  citationIds: number[];
  captureIds: number[];
}) {
  if (state === "accepted") return "Saved";
  if (citationIds.length > 0 || captureIds.length > 0) {
    const parts = [];
    if (citationIds.length > 0) parts.push(`${citationIds.length} citation${citationIds.length === 1 ? "" : "s"}`);
    if (captureIds.length > 0) parts.push(`${captureIds.length} note${captureIds.length === 1 ? "" : "s"}`);
    return `Linked to ${parts.join(" and ")}`;
  }
  if (citationId) return `Linked to citation ${citationId}`;
  return "Review before saving";
}
