export const podcastsKeys = {
  all: ["podcasts"] as const,
  shows: () => [...podcastsKeys.all, "shows"] as const,
  show: (id: string) => [...podcastsKeys.shows(), id] as const,
  episodes: (id: string) => [...podcastsKeys.show(id), "episodes"] as const,
  transcriptStatus: (id: number) => [...podcastsKeys.all, "transcript", id, "status"] as const,
  transcriptContent: (id: number) => [...podcastsKeys.all, "transcript", id, "content"] as const,
};
