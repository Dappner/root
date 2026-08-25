import { CitationMarker } from "@/components/ai/citation-marker";
import { useDialog } from "@/components/dialogs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CitationDetailSheet } from "@/features/rag/components/citation-detail-sheet";
import { citationTone } from "@/features/rag/display";
import type { CitationReference } from "@/features/rag/types";

export function CitationChip({
  citationId,
  citations,
}: {
  citationId: string;
  citations: CitationReference[];
}) {
  const { openDialog } = useDialog();
  const citationNumber = Number(citationId);
  const ref = citations.find((c) => c.index === citationNumber);
  const c = ref?.citation;

  const handleClick = () => {
    if (c) openDialog(CitationDetailSheet, { citation: c }, { isSheet: true });
  };

  const title = !c
    ? null
    : c.type === "takeaway"
      ? (c.takeaway_title ?? c.text)
      : c.type === "source_section_summary"
        ? (c.section_title ?? c.text)
        : c.type === "transcript_chunk"
          ? (c.chunk_speakers?.join(", ") ?? c.source_title ?? c.text)
          : c.text;

  const sourceLabel = c?.source_title
    ? [c.source_title, c.source_author].filter(Boolean).join(" · ")
    : null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CitationMarker
            label={ref?.display ?? citationId}
            tone={citationTone(c?.type)}
            onClick={handleClick}
          />
        }
      />
      <TooltipContent className="max-w-xs rounded-xl border border-border/60 bg-popover px-3.5 py-3 shadow-xl">
        {title && (
          <p className="mb-1 line-clamp-2 text-xs leading-snug font-semibold text-popover-foreground">
            {title}
          </p>
        )}
        {sourceLabel && (
          <p className="mb-1.5 text-[11px] font-medium text-primary">{sourceLabel}</p>
        )}
        {c?.type === "takeaway" && c.takeaway_body && c.takeaway_body !== title && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {c.takeaway_body}
          </p>
        )}
        {c?.type !== "takeaway" && c?.text && c.text !== title && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{c.text}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
