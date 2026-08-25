"use client";

import type { BaseDialogProps } from "@/components/dialogs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Book, FileText, Lightbulb, ExternalLink, Mic } from "lucide-react";
import { citationHref } from "../display";
import { useRouter } from "@/lib/nav";
import { useIsMobile } from "@/hooks/use-viewport";
import type { RagCitation } from "../types";

interface CitationDetailSheetProps extends BaseDialogProps {
  citation: RagCitation;
}

function getKindMeta(type: RagCitation["type"]) {
  switch (type) {
    case "capture":
      return {
        icon: <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
        badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20",
        label: "Comment",
      };
    case "citation":
      return {
        icon: <Book className="h-5 w-5 text-violet-600 dark:text-violet-400" />,
        badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20",
        label: "Quote",
      };
    case "takeaway":
      return {
        icon: <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
        badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20",
        label: "Insight",
      };
    case "source_section_summary":
      return {
        icon: <Book className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
        badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20",
        label: "Section summary",
      };
    case "transcript_chunk":
      return {
        icon: <Mic className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
        badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20",
        label: "Transcript",
      };
  }
}

export function CitationDetailSheet({ citation, open, onOpenChange }: CitationDetailSheetProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { icon, badge, label } = getKindMeta(citation.type);

  const handleViewSource = () => {
    const url = citationHref(citation);
    if (!url) return;

    onOpenChange(false);
    router.push(url);
  };

  const content = (
    <>
      {/* Header */}
      <div className="flex min-w-0 items-start gap-3 pb-4 border-b pr-6">
        <div className="mt-1 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 mb-1">
            <Badge className={`${badge} shrink-0`}>{label}</Badge>
            {citation.source_title && (
              <span className="min-w-0 max-w-full text-sm text-muted-foreground break-words">
                from {citation.source_title}
              </span>
            )}
          </div>
          {citation.source_id && (
            <button
              onClick={handleViewSource}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              View source
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 py-4">
        {citation.type === "takeaway" && (
          <div>
            {citation.takeaway_title && (
              <h3 className="font-semibold text-base mb-2">{citation.takeaway_title}</h3>
            )}
            {citation.takeaway_body && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {citation.takeaway_body}
              </p>
            )}
          </div>
        )}

        {citation.type === "source_section_summary" && (
          <div>
            {citation.section_title && (
              <h3 className="font-semibold text-base mb-1">{citation.section_title}</h3>
            )}
            {citation.section_subtitle && (
              <p className="text-sm text-muted-foreground mb-2">{citation.section_subtitle}</p>
            )}
            {citation.section_summary && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{citation.section_summary}</p>
            )}
          </div>
        )}

        {(citation.type === "citation" || citation.type === "capture") && citation.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{citation.text}</p>
        )}

        {citation.type === "transcript_chunk" && (
          <div>
            {(citation.chunk_speakers && citation.chunk_speakers.length > 0) && (
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {citation.chunk_speakers.join(", ")}
                {citation.chunk_start != null && citation.chunk_end != null && (
                  <span className="ml-2 font-mono">
                    {Math.floor(citation.chunk_start / 60)}:{String(Math.floor(citation.chunk_start % 60)).padStart(2, "0")}
                    {" – "}
                    {Math.floor(citation.chunk_end / 60)}:{String(Math.floor(citation.chunk_end % 60)).padStart(2, "0")}
                  </span>
                )}
              </p>
            )}
            {citation.text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{citation.text}</p>
            )}
          </div>
        )}

        {citation.type === "capture" && citation.citation_text && (
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Attached quote</Badge>
              {(citation.citation_speaker || citation.citation_context) && (
                <span className="text-xs text-muted-foreground">
                  {citation.citation_speaker}
                  {citation.citation_speaker && citation.citation_context ? " · " : ""}
                  {citation.citation_context}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
              {citation.citation_text}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2 pt-4 border-t">
          {citation.score !== undefined && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Relevance Score</span>
              <span className="font-mono">{citation.score.toFixed(4)}</span>
            </div>
          )}
          {citation.source_type && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Source Type</span>
              <Badge variant="outline" className="text-xs">{citation.source_type}</Badge>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-6 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{label} Details</SheetTitle>
            <SheetDescription>View details for this {citation.type}</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{label} Details</DialogTitle>
          <DialogDescription>View details for this {citation.type}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
