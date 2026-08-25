"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { transcriptsApi } from "@/features/admin/api";
import type { TranscriptEpisode } from "@/features/admin/types";
import { useEmbedTranscript } from "@/features/podcasts/transcript-hooks";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Cpu, Loader2 } from "lucide-react";
import { toast } from "sonner";

function EpisodeEmbedRow({ episode, onEmbedded }: { episode: TranscriptEpisode; onEmbedded: () => void }) {
  const embed = useEmbedTranscript(episode.episodeId);

  const handleEmbed = async () => {
    try {
      await embed.mutateAsync();
      toast.success(`Embedding started for "${episode.sourceTitle ?? episode.episodeTitle}"`);
      onEmbedded();
    } catch {
      toast.error("Failed to trigger embedding");
    }
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium truncate">
          {episode.sourceTitle ?? episode.episodeTitle ?? `Episode ${episode.episodeId}`}
        </span>
        <span className="text-xs text-muted-foreground">Episode #{episode.episodeId}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleEmbed}
        disabled={embed.isPending}
        className="shrink-0 ml-4"
      >
        {embed.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Embed"}
      </Button>
    </div>
  );
}

export function TranscriptEmbedCard() {
  const { data, isLoading, error, refetch } = useQuery<TranscriptEpisode[]>({
    queryKey: ["admin", "transcript-episodes"],
    queryFn: transcriptsApi.getEpisodes,
    staleTime: 30_000,
  });

  if (error) return null;

  const episodes = data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Transcript Embeddings
            </CardTitle>
            <CardDescription>Transcribed episodes not yet embedded</CardDescription>
          </div>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : episodes.length === 0 ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <span className="text-2xl font-bold">{episodes.length}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && episodes.length === 0 && (
          <p className="text-sm text-muted-foreground">All transcripts are embedded.</p>
        )}
        {!isLoading && episodes.length > 0 && (
          <div>
            {episodes.map((episode) => (
              <EpisodeEmbedRow key={episode.episodeId} episode={episode} onEmbedded={refetch} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
