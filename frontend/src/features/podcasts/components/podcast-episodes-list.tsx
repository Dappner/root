"use client";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useSources } from "@/features/sources/hooks/sources";
import { sourcesKeys } from "@/features/sources/keys";
import { routes } from "@/lib/routes";
import { formatDuration } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Clock, Mic, Plus } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { useState } from "react";
import { toast } from "sonner";
import { useAddPodcastToLibrary, usePodcastEpisodes } from "../hooks";
import { EpisodeAudioPlayer } from "./episode-audio-player";
import { TranscriptStatusBadge } from "./transcript-status-badge";

interface PodcastEpisodesListProps {
  slug: string;
}

const EPISODES_PER_PAGE = 20;

export function PodcastEpisodesList({ slug }: PodcastEpisodesListProps) {
  const router = useRouter();
  const query = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingEpisodeId, setLoadingEpisodeId] = useState<number | null>(null);
  const offset = (currentPage - 1) * EPISODES_PER_PAGE;

  const { data: response, isPending } = usePodcastEpisodes(slug, EPISODES_PER_PAGE, offset);
  const { data: sourceListResponse } = useSources("podcast");
  const addToLibrary = useAddPodcastToLibrary();

  // Extract data and pagination from response
  const episodes = response?.data ?? [];
  const pagination = response?.pagination;
  const hasNextPage = pagination?.has_next ?? false;
  const hasPrevPage = pagination?.has_previous ?? false;
  const totalEpisodes = pagination?.total ?? 0;

  const handleAddToLibrary = async (episodeId: number) => {
    setLoadingEpisodeId(episodeId);
    try {
      const source = await addToLibrary.mutateAsync({ episode_id: episodeId });
      query.invalidateQueries({ queryKey: sourcesKeys.list() });
      toast.success("Added to library");
      router.push(routes.source(source.id));
    } catch {
      toast.error("Failed to add to library");
    } finally {
      setLoadingEpisodeId(null);
    }
  };

  const getSourceForEpisode = (episodeId: number) => {
    return sourceListResponse?.sources?.find(s => {
      return episodeId == s.episode_id;
    });
  };

  return (
    <div className="container mx-auto px-4 md:px-8 pb-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Episodes</h2>
            {totalEpisodes > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {totalEpisodes} total episode{totalEpisodes !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasPrevPage || isPending}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm font-medium">Page {currentPage}</span>
              {totalEpisodes > 0 && (
                <span className="text-sm text-muted-foreground">
                  of {Math.ceil(totalEpisodes / EPISODES_PER_PAGE)}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasNextPage || isPending}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
        {isPending ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : episodes && episodes.length > 0 ? (
          <div className="space-y-6">
            {episodes.map((episode) => {
              const source = getSourceForEpisode(episode.id);
              const isAddingThis = loadingEpisodeId === episode.id;
              return (
                <div key={episode.id} className="group space-y-3 pb-6 border-b last:border-b-0">
                  <div className="flex gap-4">
                    <div className="size-32 shrink-0 rounded-lg overflow-hidden border bg-secondary transition-all group-hover:shadow-md">
                      {episode.image_url ? (
                        <img
                          src={episode.image_url}
                          alt={episode.title || "Episode artwork"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Mic className="size-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base line-clamp-2 leading-tight">{episode.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                            {episode.published_at && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(episode.published_at), "MMM d, yyyy")}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {episode.duration && formatDuration(episode.duration)}
                            </div>
                            {episode.season && <span>S{episode.season}</span>}
                            {episode.episode_number && <span>E{episode.episode_number}</span>}
                            <TranscriptStatusBadge status={episode.transcript_status} />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={source ? "outline" : "default"}
                          disabled={isAddingThis}
                          onClick={() => source ? router.push(routes.source(source.id)) : handleAddToLibrary(episode.id)}
                          className="shrink-0"
                        >
                          {source ? (
                            <>
                              Go to Source
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                          ) : isAddingThis ? (
                            <>
                              Loading...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Add to Library
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
                        {episode.description?.replace(/<[^>]*>?/gm, '')}
                      </p>
                    </div>
                  </div>

                  {/* Audio Player */}
                  {episode.enclosure_url && (
                    <div className="pl-32">
                      <EpisodeAudioPlayer episode={episode} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty className="py-12 rounded-xl">
            <EmptyHeader>
              <EmptyDescription>
                No episodes found for this show.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
