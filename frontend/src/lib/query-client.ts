"use client";

import { QueryClient } from "@tanstack/react-query";
import { APIError } from "./fetchers/api-fetcher";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (reduced from 7 days to prevent memory bloat)
        refetchOnWindowFocus: false,
        structuralSharing: true, // Helps reduce memory with large arrays
        retry: (failureCount, error) => {
          // Don't retry on 401 errors
          if (error instanceof APIError && error.isUnauthorized()) {
            return false;
          }
          return failureCount < 1;
        },
        throwOnError: (error) => {
          // Redirect to login on 401 errors
          if (error instanceof APIError && error.isUnauthorized()) {
            if (typeof window !== "undefined" && window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
            return false;
          }
          return false;
        },
      },
      mutations: {
        retry: false,
        gcTime: 0, // Don't cache mutation results
        onError: (error) => {
          // Redirect to login on 401 errors
          if (error instanceof APIError && error.isUnauthorized()) {
            if (typeof window !== "undefined" && window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
          }
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
