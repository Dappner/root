"use client";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils/number";
import { FileUp, Loader2 } from "lucide-react";

export function PdfEmptyState({
  hasPdf,
  pageCount,
  sizeBytes,
  isFetchingUrl,
  isUploading,
  error,
  onOpenPdf,
  onReplacePdf,
}: {
  hasPdf: boolean;
  pageCount: number | null;
  sizeBytes: number | null;
  isFetchingUrl: boolean;
  isUploading: boolean;
  error: string | null;
  onOpenPdf: () => void;
  onReplacePdf: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">PDF</h2>
        <p className="text-muted-foreground text-sm">
          Upload a PDF with a text layer. Max 500 pages and 50MB.
        </p>
      </div>

      {hasPdf ? (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Pages: {pageCount}</div>
            {sizeBytes !== null && <div>Size: {formatBytes(sizeBytes)}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onOpenPdf} disabled={isFetchingUrl}>
              {isFetchingUrl ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading PDF...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Open PDF
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onReplacePdf}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Replacing...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Replace PDF
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileUp className="h-4 w-4" />
                Drop a PDF here, or upload to start highlighting
              </div>
              <p className="text-xs text-muted-foreground">
                Text-layer PDFs only. Max 500 pages, 50MB. Scanned PDFs need OCR.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={onReplacePdf}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
