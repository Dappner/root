"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialogs";
import { useSource } from "@/features/sources/hooks/sources";
import {
  useCitationsWithCaptures,
  useCreateCitation,
  useDeleteCitation,
} from "@/features/sources/hooks/citations";
import type { CitationDTO, CreateCitationRequest } from "@/features/sources/types";
import { pdfApi } from "@/features/sources/api";
import { sourcesKeys } from "@/features/sources/keys";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { getPdfPageCount } from "@/features/sources/utils/pdf";
import { roundPdfPosition } from "@/features/sources/utils/pdf-position";
import { formatBytes } from "@/lib/utils/number";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { HighlightActionBar, SelectionActionBar } from "./components/pdf-action-bars";
import { PdfEmptyState } from "./components/pdf-empty-state";
import { citationToHighlight, mergeHighlights, toPdfPosition } from "./utils";
import {
  PdfHighlighter,
  PdfLoader,
  useZoom,
  type IHighlight,
  type ScaledPosition,
} from "@nicklasastorian/react-pdf-annotator";
import { pdfjs } from "react-pdf";
import "@nicklasastorian/react-pdf-annotator/style.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_PDF_PAGES = 500;

interface SourcePdfSlideoverProps {
  sourceId: number;
  isPanelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  scrollToCitationId?: number | null;
}

export function SourcePdfSlideover({
  sourceId,
  isPanelOpen,
  onPanelOpenChange,
  scrollToCitationId,
}: SourcePdfSlideoverProps) {
  const { data: source } = useSource(sourceId);
  const { data: citationsWithCaptures = [] } = useCitationsWithCaptures(sourceId);
  const createCitation = useCreateCitation();
  const deleteCitation = useDeleteCitation();
  const queryClient = useQueryClient();
  const { openDialog } = useDialog();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hasAttemptedAutoOpen, setHasAttemptedAutoOpen] = useState(false);
  const [optimisticHighlights, setOptimisticHighlights] = useState<Array<IHighlight>>([]);
  const pendingSelectionRef = useRef<{
    position: ScaledPosition;
    content: { text?: string; image?: string };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollToHighlightRef = useRef<(highlight: IHighlight) => void>(() => { });
  const lastScrolledIdRef = useRef<number | null>(null);
  const scrollAttemptRef = useRef(0);
  const zoomRef = viewerRef as RefObject<HTMLElement>;
  const { pdfScaleValue, zoomLabel, zoomIn, zoomOut, fitWidth } = useZoom(
    zoomRef,
    isPanelOpen,
  );

  const serverHighlights = citationsWithCaptures
    .map(({ citation, captures }) =>
      citationToHighlight(
        citation,
        captures.length > 0 ? captures.map((c) => c.text).join("\n\n") : null,
      ),
    )
    .filter((highlight): highlight is IHighlight => Boolean(highlight));
  const highlights = mergeHighlights(serverHighlights, optimisticHighlights);

  const metadata = (source?.metadata as Record<string, unknown> | undefined) ?? {};
  const pageCount = typeof metadata.page_count === "number" ? metadata.page_count : null;
  const sizeBytes = typeof metadata.size_bytes === "number" ? metadata.size_bytes : null;
  const hasPdf = pageCount !== null;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.type && !file.type.includes("pdf")) {
      setError("File must be a PDF.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_PDF_BYTES) {
      setError("PDF must be 50MB or smaller.");
      event.target.value = "";
      return;
    }

    let detectedPages = 0;
    try {
      detectedPages = await getPdfPageCount(file);
    } catch {
      setError("Failed to read PDF for validation.");
      event.target.value = "";
      return;
    }

    if (detectedPages > MAX_PDF_PAGES) {
      setError("PDF must be 500 pages or fewer.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      await pdfApi.uploadPdf(sourceId, file);
      setPdfUrl(null);
      setHasAttemptedAutoOpen(false);
      queryClient.invalidateQueries({ queryKey: sourcesKeys.detail(sourceId) });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload PDF.";
      setError(message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleReplacePdf = () => {
    setError(null);
    if (hasPdf) {
      setIsReplaceConfirmOpen(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const confirmReplacePdf = () => {
    setIsReplaceConfirmOpen(false);
    fileInputRef.current?.click();
  };

  const handleOpenPdf = async (mode: "new-tab" | "viewer") => {
    setError(null);
    setIsFetchingUrl(true);
    try {
      const payload = await pdfApi.getPdfUrl(sourceId);
      const url = payload?.url as string | undefined;
      if (!url) {
        throw new Error("PDF URL unavailable.");
      }
      if (mode === "new-tab") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setPdfUrl(url);
        onPanelOpenChange(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load PDF URL.";
      setError(message);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const openQuoteDialogFromSelection = (
    position: ScaledPosition,
    content: { text?: string; image?: string },
  ) => {
    if (!source?.id) return;
    pendingSelectionRef.current = { position, content };
    openDialog(CitationDialog, {
      mode: "create",
      flow: "derived",
      sourceId: source.id,
      quoteText: content.text ?? "",
      location: {
        mode: "derived",
        type: "pdf_v1",
        pdf: { position: roundPdfPosition(toPdfPosition(position), 3) },
      },
      onSaved: () => {
        pendingSelectionRef.current = null;
      },
      onCancel: () => {
        pendingSelectionRef.current = null;
      },
    });
  };

  const openEditCitationDialog = (highlight: IHighlight) => {
    const citation = (highlight.meta as { citation?: CitationDTO } | undefined)?.citation;
    if (!citation) return;
    const location = citation.location as { type?: string } | null;
    const isDerived = location?.type === "pdf_v1" || location?.type === "transcript_v1";
    openDialog(CitationDialog, {
      mode: "update",
      flow: isDerived ? "derived" : "manual",
      citation,
      sourceId: source?.id,
    });
  };

  const handleQuickSave = async (
    position: ScaledPosition,
    content: { text?: string; image?: string },
  ) => {
    if (!source?.id || !content.text?.trim()) return null;
    const tempId = `temp-${Date.now()}`;
    const tempHighlight: IHighlight = {
      id: tempId,
      content: { text: content.text.trim() },
      position,
      comment: "",
      meta: { pending: true },
    };

    setOptimisticHighlights((prev) => mergeHighlights(prev, [tempHighlight]));

    const payload: CreateCitationRequest = {
      info_type: "quote",
      text: content.text.trim(),
      source_id: source.id,
      location: {
        mode: "derived",
        type: "pdf_v1",
        pdf: {
          position: roundPdfPosition(toPdfPosition(position), 3),
        },
      },
    };

    try {
      const result = await createCitation.mutateAsync(payload);
      const highlight = result.citation ? citationToHighlight(result.citation) : null;
      if (highlight) {
        setOptimisticHighlights((prev) => [
          ...prev.filter((item) => item.id !== tempId),
          highlight,
        ]);
        return highlight;
      }
    } catch (err) {
      setOptimisticHighlights((prev) => prev.filter((item) => item.id !== tempId));
      const message = err instanceof Error ? err.message : "Failed to save highlight.";
      setError(message);
    }

    return null;
  };

  const handleDeleteHighlight = async (highlight: IHighlight) => {
    const citation = (highlight.meta as { citation?: CitationDTO } | undefined)?.citation;
    if (!citation?.id) return;
    try {
      await deleteCitation.mutateAsync({ id: citation.id, sourceId });
      setOptimisticHighlights((prev) => prev.filter((item) => item.id !== highlight.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete highlight.";
      setError(message);
    }
  };

  const tryScrollToCitation = useCallback(() => {
    if (!scrollToCitationId || !isPanelOpen || !pdfUrl) return;
    if (lastScrolledIdRef.current === scrollToCitationId) return;

    const highlight = highlights.find(
      (item) => item.id === `citation-${scrollToCitationId}`
    );
    if (!highlight) return;

    lastScrolledIdRef.current = scrollToCitationId;
    scrollToHighlightRef.current?.(highlight);
  }, [scrollToCitationId, highlights, isPanelOpen, pdfUrl]);

  useEffect(() => {
    if (!scrollToCitationId) return;
    requestAnimationFrame(tryScrollToCitation);
  }, [scrollToCitationId, tryScrollToCitation]);

  useEffect(() => {
    if (!isPanelOpen) {
      lastScrolledIdRef.current = null;
      scrollAttemptRef.current = 0;
      setHasAttemptedAutoOpen(false);
      return;
    }
    if (!scrollToCitationId) return;

    const attemptScroll = () => {
      scrollAttemptRef.current += 1;
      tryScrollToCitation();
      if (lastScrolledIdRef.current === scrollToCitationId) return;
      if (scrollAttemptRef.current < 6) {
        setTimeout(attemptScroll, 150);
      }
    };

    attemptScroll();
  }, [isPanelOpen, scrollToCitationId, tryScrollToCitation]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !isPanelOpen) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.shiftKey || event.ctrlKey || !viewerRef.current) return;
      const target = event.target;
      if (!(target instanceof Node) || !viewerRef.current.contains(target)) return;

      // Find the actual PDF.js scrollable container
      const pdfContainer = viewerRef.current.querySelector('.pdfViewer')?.parentElement;
      if (!pdfContainer) return;

      event.preventDefault();
      pdfContainer.scrollLeft += event.deltaY;
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [isPanelOpen]);

  useEffect(() => {
    // Only fetch PDF URL when panel opens and we don't have one yet
    if (isPanelOpen && hasPdf && !pdfUrl && !isFetchingUrl && !hasAttemptedAutoOpen) {
      setHasAttemptedAutoOpen(true);
      handleOpenPdf("viewer");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAttemptedAutoOpen, hasPdf, isFetchingUrl, isPanelOpen, pdfUrl]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={isUploading}
        className="sr-only"
      />

      <AlertDialog open={isReplaceConfirmOpen} onOpenChange={setIsReplaceConfirmOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace PDF?</AlertDialogTitle>
            <AlertDialogDescription>
              Replacing this PDF will remove all PDF-based citations and captures for this source.
              Manual notes and non-PDF highlights will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isUploading}
              onClick={confirmReplacePdf}
            >
              Replace PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className={`fixed inset-0 z-50 transition-opacity ${isPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        aria-hidden={!isPanelOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${isPanelOpen ? "opacity-100" : "opacity-0"
            }`}
          onClick={() => onPanelOpenChange(false)}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-[90vw] max-w-[1200px] min-w-[24rem] bg-background shadow-2xl flex flex-col"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <div className="text-sm font-medium">PDF Viewer</div>
              <div className="text-xs text-muted-foreground">
                {pageCount != null ? `${pageCount} pages` : "No PDF uploaded"}
                {sizeBytes != null ? ` • ${formatBytes(sizeBytes)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasPdf && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReplacePdf}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Replacing...
                    </>
                  ) : (
                    "Replace PDF"
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={zoomOut}>
                -
              </Button>
              <div className="text-xs tabular-nums text-muted-foreground w-12 text-center">
                {zoomLabel}
              </div>
              <Button variant="outline" size="sm" onClick={zoomIn}>
                +
              </Button>
              <Button variant="ghost" size="sm" onClick={fitWidth}>
                Fit width
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onPanelOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={viewerRef} className="flex-1 relative overflow-hidden pdf-viewer">
            {hasPdf && pdfUrl ? (
              <PdfLoader
                url={pdfUrl}
                beforeLoad={
                  <div className="flex items-center text-sm text-muted-foreground px-4 py-3">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading PDF...
                  </div>
                }
              >
                {(pdfDocument) => (
                  <PdfHighlighter
                    pdfDocument={pdfDocument}
                    pdfScaleValue={pdfScaleValue}
                    disallowOverlappingHighlights
                    onOverlap={() => {
                      toast.error("That highlight overlaps an existing highlight on the same line.");
                    }}
                    enableAreaSelection={() => false}
                    onScrollChange={() => { }}
                    scrollRef={(scrollTo) => {
                      scrollToHighlightRef.current = scrollTo;
                      tryScrollToCitation();
                    }}
                    onSelectionFinished={(
                      position: ScaledPosition,
                      content: { text?: string; image?: string },
                      hideTipAndSelection: () => void,
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      _transformSelection: () => void,
                    ) => (
                      <SelectionActionBar
                        position={position}
                        content={content}
                        onSave={handleQuickSave}
                        onAddQuote={(nextPosition, nextContent) => {
                          openQuoteDialogFromSelection(nextPosition, nextContent);
                          hideTipAndSelection();
                        }}
                        onEdit={openEditCitationDialog}
                        onDelete={handleDeleteHighlight}
                      />
                    )}
                    renderPopup={(highlight) => (
                      <HighlightActionBar
                        highlight={highlight}
                        onEdit={() => openEditCitationDialog(highlight)}
                        onDelete={() => handleDeleteHighlight(highlight)}
                      />
                    )}
                    highlights={highlights}
                  />
                )}
              </PdfLoader>
            ) : hasPdf ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading PDF...
              </div>
            ) : (
              <PdfEmptyState
                hasPdf={hasPdf}
                pageCount={pageCount}
                sizeBytes={sizeBytes}
                isFetchingUrl={isFetchingUrl}
                isUploading={isUploading}
                error={error}
                onOpenPdf={() => handleOpenPdf("new-tab")}
                onReplacePdf={handleReplacePdf}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
