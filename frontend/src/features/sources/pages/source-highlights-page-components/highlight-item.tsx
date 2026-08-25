"use client";

import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteCaptureDialog } from "@/features/captures/dialogs/delete-capture-dialog";
import { useMediaPlayerSafe } from "@/features/sources/contexts/media-player-context";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { DeleteCitationDialog } from "@/features/sources/dialogs/delete-citation-dialog";
import { MoveHighlightDialog } from "@/features/sources/dialogs/move-highlight-dialog";
import { useSource } from "@/features/sources/hooks/sources";
import type { CitationWithCapture } from "@/features/sources/types";
import { formatCitationLocation, getLocationTimestamp, getPdfPosition, type CitationLocation } from "@/features/sources/utils/location";
import { TakeawayBadge } from "@/features/takeaways/components/takeaway-badge";
import { routes } from "@/lib/routes";
import { AddToTakeawayDialog } from "@/features/takeaways/dialogs/add-to-takeaway-dialog";
import { Bookmark, File, FileText, MapPin, MoveRight, Pencil, Quote, Trash2 } from "lucide-react";
import { useRouter } from "@/lib/nav";

interface HighlightItemProps {
  citationWithCapture: CitationWithCapture;
  sourceId: number;
  currentSectionId?: number;
}

export function HighlightItem({
  citationWithCapture,
  sourceId,
  currentSectionId,
}: HighlightItemProps) {
  const router = useRouter();
  const { openDialog } = useDialog();
  const { citation, captures } = citationWithCapture;
  const { data: source } = useSource(sourceId);
  const player = useMediaPlayerSafe();

  const isPodcast = source?.type === "podcast";
  const hasCapture = captures.length > 0;
  const isQuote = citation.info_type === "quote";
  const locationLabel = formatCitationLocation(citation.location);
  const timestamp = getLocationTimestamp(citation.location as CitationLocation | null);
  const hasTimestamp = timestamp?.startSec !== undefined;
  const hasPdfPosition = Boolean(getPdfPosition(citation.location as CitationLocation | null));

  const handleMove = () => {
    openDialog(MoveHighlightDialog, {
      highlightId: citation.id,
      highlightType: "citation",
      sourceId,
      currentSectionId,
      highlightText: citation.text,
      highlightLocationLabel: locationLabel,
    });
  };

  const handleEditCitation = () => {
    const location = citation.location as CitationLocation | null;
    const isDerived = location?.type === "transcript_v1" || location?.type === "pdf_v1";
    openDialog(CitationDialog, {
      mode: "update",
      flow: isDerived ? "derived" : "manual",
      citation,
      sourceId,
    });
  };

  const handleDeleteCitation = () => {
    openDialog(DeleteCitationDialog, {
      citation,
      sourceId,
      hasCapture,
    });
  };

  const handleDeleteCapture = (capture: typeof captures[number]) => {
    openDialog(DeleteCaptureDialog, { capture });
  };

  const handleAddToTakeaway = () => {
    openDialog(AddToTakeawayDialog, {
      sourceId,
      citationId: citation.id,
    });
  };

  const handleGoToTranscript = () => {
    const startSec = timestamp?.startSec ?? 0;
    router.push(routes.sourceTranscript(sourceId, { timestampSec: startSec }));
  };

  const handleOpenPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("pdf:open", {
        detail: { sourceId, citationId: citation.id },
      }),
    );
  };

  const handleSeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timestamp?.startSec !== undefined && player) {
      player.seek(timestamp.startSec);
      if (!player.isPlaying) {
        player.play();
      }
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={
        <div id={`citation-${citation.id}`} className="border border-l-2 border-l-emerald-600 rounded-lg hover:bg-muted/30 transition-colors scroll-mt-20">
          {/* Desktop: Horizontal layout */}
          <div className="hidden md:flex items-start gap-3 p-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isQuote && <Quote className="h-3 w-3 shrink-0" />}
                {locationLabel && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {isPodcast && hasTimestamp ? (
                      <button
                        type="button"
                        onClick={handleSeek}
                        className="truncate hover:text-primary hover:underline cursor-pointer"
                      >
                        {locationLabel}
                      </button>
                    ) : (
                      <span className="truncate">{locationLabel}</span>
                    )}
                  </div>
                )}
                {citation.takeaways && citation.takeaways.length > 0 && (
                  <TakeawayBadge takeaways={citation.takeaways} sourceId={sourceId} />
                )}
              </div>

              {/* Citation text */}
              <p className={`text-sm leading-relaxed whitespace-pre-wrap${isQuote ? "" : " italic"}`}>{citation.text}</p>

              {/* Speaker and Context */}
              {(citation.speaker || citation.context) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {citation.speaker && (
                    <span className="font-medium">— {citation.speaker}</span>
                  )}
                  {citation.context && (
                    <span className="italic">({citation.context})</span>
                  )}
                </div>
              )}

              {/* Capture notes if any */}
              {captures.length > 0 && (
                <div className="space-y-2">
                  {captures.map((capture) => (
                    <div key={capture.id} className="pl-3 border-l-2 border-l-amber-700">
                      <p className="text-sm text-muted-foreground italic">{capture.text}</p>
                      {capture.summary && (
                        <p className="text-xs text-muted-foreground mt-1">Summary: {capture.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasPdfPosition && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenPdf}
                  title="Open in PDF"
                >
                  <File className="h-4 w-4" />
                </Button>
              )}
              {hasTimestamp && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleGoToTranscript}
                  title="Go to transcript"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEditCitation}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile: Stacked layout */}
          <div className="md:hidden p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {isQuote && <Quote className="h-3 w-3 shrink-0" />}
              {locationLabel && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {isPodcast && hasTimestamp ? (
                    <button
                      type="button"
                      onClick={handleSeek}
                      className="truncate hover:text-primary hover:underline cursor-pointer"
                    >
                      {locationLabel}
                    </button>
                  ) : (
                    <span className="truncate">{locationLabel}</span>
                  )}
                </div>
              )}
              {citation.takeaways && citation.takeaways.length > 0 && (
                <TakeawayBadge takeaways={citation.takeaways} sourceId={sourceId} />
              )}
            </div>

            <div className="space-y-2">
              {/* Citation text */}
              <p className={`text-sm leading-relaxed whitespace-pre-wrap${isQuote ? "" : " italic"}`}>{citation.text}</p>

              {/* Speaker and Context */}
              {(citation.speaker || citation.context) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {citation.speaker && (
                    <span className="font-medium">— {citation.speaker}</span>
                  )}
                  {citation.context && (
                    <span className="italic">({citation.context})</span>
                  )}
                </div>
              )}

              {/* Capture notes if any */}
              {captures.length > 0 && (
                <div className="space-y-2">
                  {captures.map((capture) => (
                    <div key={capture.id} className="pl-3 border-l-2 border-l-amber-700">
                      <p className="text-sm text-muted-foreground italic">{capture.text}</p>
                      {capture.summary && (
                        <p className="text-xs text-muted-foreground mt-1">Summary: {capture.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 pt-1">
              {hasPdfPosition && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleOpenPdf}
                  title="Open in PDF"
                >
                  <File className="h-3.5 w-3.5 mr-1" />
                  PDF
                </Button>
              )}
              {hasTimestamp && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleGoToTranscript}
                  title="Go to transcript"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Transcript
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleEditCitation}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      }>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleEditCitation}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleAddToTakeaway}>
          <Bookmark className="mr-2 h-4 w-4" />
          Add to Takeaway
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMove}>
          <MoveRight className="mr-2 h-4 w-4" />
          Move to Section
        </ContextMenuItem>
        <ContextMenuSeparator />
        {captures.map((capture, index) => (
          <ContextMenuItem
            key={capture.id}
            onClick={() => handleDeleteCapture(capture)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {captures.length > 1 ? `Delete Comment ${index + 1}` : "Delete Comment"}
          </ContextMenuItem>
        ))}
        <ContextMenuItem onClick={handleDeleteCitation} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Citation
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
