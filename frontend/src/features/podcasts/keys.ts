export const podcastsKeys = {
  all: ["podcasts"] as const,
  shows: () => [...podcastsKeys.all, "shows"] as const,
  show: (url: string) => [...podcastsKeys.shows(), url] as const,
  episodes: (url: string) => [...podcastsKeys.show(url), "episodes"] as const,
  transcript: (episodeId: number) => [...podcastsKeys.all, "transcript", episodeId] as const,
  transcriptContent: (episodeId: number) => [...podcastsKeys.transcript(episodeId), "content"] as const,
  audioUrl: (episodeId: number) => [...podcastsKeys.all, "audioUrl", episodeId] as const,
};
