"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useProcessStaleEmbeddings, useStaleEmbeddingsCount } from "../hooks/embeddings";

interface StaleEmbeddingsCardProps {
  userId: string;
}

export function StaleEmbeddingsCard({ userId }: StaleEmbeddingsCardProps) {
  const { data, isLoading, error } = useStaleEmbeddingsCount(userId);
  const processEmbeddings = useProcessStaleEmbeddings();

  const handleProcess = async () => {
    try {
      const result = await processEmbeddings.mutateAsync({ userId, limit: 200 });
      const transcriptParts: string[] = [];
      if (result.transcript_sources_embedded > 0)
        transcriptParts.push(`${result.transcript_sources_embedded} transcripts`);
      if (result.transcript_sources_failed > 0)
        transcriptParts.push(`${result.transcript_sources_failed} failed`);
      if (result.transcript_sources_skipped > 0)
        transcriptParts.push(`${result.transcript_sources_skipped} skipped`);
      const detail = transcriptParts.length ? ` (${transcriptParts.join(", ")})` : "";
      toast.success(`Processed ${result.processed} embeddings${detail}`);
    } catch {
      toast.error("Failed to process embeddings");
    }
  };

  if (error) {
    return null
  }

  const staleCount = data?.stale_count ?? 0;
  const hasStale = staleCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Embedding Generation
            </CardTitle>
            <CardDescription>
              Process content missing vector embeddings
            </CardDescription>
          </div>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : hasStale ? (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                Failed to load stale embeddings count
              </p>
            </div>
          )}

          {!error && (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{staleCount}</span>
                <span className="text-sm text-muted-foreground">
                  items missing embeddings
                </span>
              </div>

              <Button
                onClick={handleProcess}
                disabled={!hasStale || processEmbeddings.isPending || isLoading}
                className="w-full"
                variant={hasStale ? "default" : "outline"}
              >
                {processEmbeddings.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Process Stale Embeddings
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Batch size: 200 items per type per click (citations, captures,
                takeaways, sections, and up to 200 transcript sources). New
                content is processed automatically.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
