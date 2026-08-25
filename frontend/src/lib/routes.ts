/**
 * Centralized route definitions for the frontend.
 *
 * Use these instead of hardcoding path strings. Renaming a route only requires
 * updating this file. Parameterless paths are constants; parameterized paths
 * are builder functions. Query/hash variants accept an optional options bag.
 */

type IdLike = string | number;

const join = (path: string, query?: Record<string, string | number | undefined>, hash?: string) => {
  let result = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) result += `?${qs}`;
  }
  if (hash) result += `#${hash}`;
  return result;
};

export const routes = {
  root: "/",

  // Auth
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  profile: "/profile",

  // Top-level pages
  ask: "/ask",
  notes: "/notes",
  note: (noteId: IdLike) => `/notes/${noteId}`,
  suggestions: "/suggestions",
  graph: "/graph",
  admin: "/admin",

  // Library / sources
  library: "/library",
  source: (sourceId: IdLike) => `/library/${sourceId}`,
  sourceTakeaways: (sourceId: IdLike) => `/library/${sourceId}/takeaways`,
  sourceTakeaway: (sourceId: IdLike, takeawayId: IdLike) =>
    `/library/${sourceId}/takeaways/${takeawayId}`,
  sourceTakeawayNew: (sourceId: IdLike) => `/library/${sourceId}/takeaways/new`,
  sourceHighlights: (sourceId: IdLike) => `/library/${sourceId}/highlights`,
  sourceNotes: (sourceId: IdLike) => `/library/${sourceId}/notes`,
  sourceNote: (sourceId: IdLike, noteId: IdLike) =>
    `/library/${sourceId}/notes/${noteId}`,
  sourceSection: (sourceId: IdLike, sectionId: IdLike | "unsorted") =>
    `/library/${sourceId}/sections/${sectionId}`,
  sourceSectionUnsorted: (sourceId: IdLike) =>
    `/library/${sourceId}/sections/unsorted`,
  sourceTranscript: (sourceId: IdLike, opts?: { section?: IdLike; timestampSec?: number }) =>
    join(
      `/library/${sourceId}/transcript`,
      opts?.section !== undefined ? { section: opts.section } : undefined,
      opts?.timestampSec !== undefined ? `t-${opts.timestampSec}` : undefined,
    ),

  // Collections
  collections: "/library/collections",
  collection: (collectionId: IdLike) => `/library/collections/${collectionId}`,

  // Discover
  discoverPodcasts: "/discover/podcasts",
  discoverPodcastShow: (slug: string) => `/discover/podcasts/${slug}`,
} as const;
