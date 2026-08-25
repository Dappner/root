import { QueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_TIME_MS = 60_000;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: (failureCount, error) => {
          const status = typeof error === "object" && error !== null && "status" in error
            ? Number((error as { status?: unknown }).status)
            : null;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
