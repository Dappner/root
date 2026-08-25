/**
 * React Query keys for videos feature
 */

export const videoKeys = {
  all: ["videos"] as const,
  lists: () => [...videoKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...videoKeys.lists(), filters] as const,
  details: () => [...videoKeys.all, "detail"] as const,
  detail: (id: number) => [...videoKeys.details(), id] as const,
  transcript: (id: number) => [...videoKeys.all, "transcript", id] as const,
  transcriptStatus: (id: number) => [...videoKeys.all, "transcript-status", id] as const,
};

export const channelKeys = {
  all: ["channels"] as const,
  lists: () => [...channelKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...channelKeys.lists(), filters] as const,
  details: () => [...channelKeys.all, "detail"] as const,
  detail: (id: number) => [...channelKeys.details(), id] as const,
  videos: (id: number, filters: Record<string, unknown>) =>
    [...channelKeys.all, id, "videos", filters] as const,
};
