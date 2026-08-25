import type { SourceDTO, SourceType } from "@/features/sources/types";
import { formatDateUTC, formatDuration } from "@/lib/utils/date";

// Re-export SourceType for backwards compatibility
export type { SourceType } from "@/features/sources/types";

type BookMetadata = {
  isbn?: string;
  pages?: number;
  url?: string;
};

type VideoMetadata = {
  url?: string;
  duration?: number;
};

type PodcastMetadata = {
  url?: string;
  episode?: string;
  duration?: number;
  current_position?: number; // playback position in seconds
  last_listened_at?: string; // ISO timestamp
  completed?: boolean; // whether user finished the episode
};

type ArticleMetadata = {
  url?: string;
  publication?: string;
  published_at?: string;
};

type PdfMetadata = {
  page_count?: number;
  has_text_layer?: boolean;
  size_bytes?: number;
};

export type SourceMetadataByType = {
  book: BookMetadata;
  video: VideoMetadata;
  podcast: PodcastMetadata;
  article: ArticleMetadata;
  pdf: PdfMetadata;
};

type MetadataField = {
  key: string;
  label: string;
  type: "text" | "number" | "url" | "date" | "duration";
  placeholder: string;
  required?: boolean;
  showInDetails?: boolean;
};

type SourceTypeConfig = {
  label: string;
  authorLabel: string;
  authorPlaceholder: string;
  requiresUrl: boolean;
  metadataFields: MetadataField[];
};

export const sourceTypeConfig: Record<SourceType, SourceTypeConfig> = {
  book: {
    label: "Book",
    authorLabel: "Author",
    authorPlaceholder: "Author name",
    requiresUrl: false,
    metadataFields: [
      {
        key: "isbn",
        label: "ISBN",
        type: "text",
        placeholder: "978-0-123456-78-9",
      },
      {
        key: "pages",
        label: "Pages",
        type: "number",
        placeholder: "Number of pages",
      },
      {
        key: "url",
        label: "URL",
        type: "url",
        placeholder: "https://example.com/book",
        showInDetails: false,
      },
    ],
  },
  video: {
    label: "Video",
    authorLabel: "Channel",
    authorPlaceholder: "Channel name",
    requiresUrl: true,
    metadataFields: [
      {
        key: "url",
        label: "URL",
        type: "url",
        placeholder: "https://youtube.com/watch?v=...",
        showInDetails: false,
      },
      { key: "duration", label: "Duration", type: "duration", placeholder: "" },
    ],
  },
  article: {
    label: "Article",
    authorLabel: "Author",
    authorPlaceholder: "Author or creator name",
    requiresUrl: true,
    metadataFields: [
      {
        key: "url",
        label: "URL",
        type: "url",
        placeholder: "https://example.com/article",
        showInDetails: false,
      },
      {
        key: "publication",
        label: "Publication",
        type: "text",
        placeholder: "Publication name",
      },
      {
        key: "published_at",
        label: "Published Date",
        type: "date",
        placeholder: "",
      },
    ],
  },
  podcast: {
    label: "Podcast",
    authorLabel: "Show",
    authorPlaceholder: "Show name",
    requiresUrl: true,
    metadataFields: [
      {
        key: "url",
        label: "URL",
        type: "url",
        placeholder: "https://podcast.com/episode",
        showInDetails: false,
      },
      {
        key: "episode",
        label: "Episode",
        type: "text",
        placeholder: "Episode name or number",
      },
      { key: "duration", label: "Duration", type: "duration", placeholder: "" },
    ],
  },
  pdf: {
    label: "PDF",
    authorLabel: "Author",
    authorPlaceholder: "Author name",
    requiresUrl: false,
    metadataFields: [],
  },
};


export function getTypeConfig(type: SourceType): SourceTypeConfig {
  return sourceTypeConfig[type];
}

export function sanitizeMetadataByType(
  type: SourceType,
  metadata: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const config = getTypeConfig(type);
  const cleaned: Record<string, unknown> = {};
  let hasValues = false;

  const allKeys = config.metadataFields.map((field) => field.key);

  for (const key of allKeys) {
    const raw = metadata[key];
    if (raw === undefined || raw === null || raw === "") continue;

    const field = config.metadataFields.find((f) => f.key === key);
    const isNumber = field?.type === "number" || field?.type === "duration";
    const value = isNumber ? Number(raw) : raw;

    if (isNumber && Number.isNaN(value)) continue;

    cleaned[key] = value;
    hasValues = true;
  }

  return hasValues ? cleaned : undefined;
}

export function canAutoEnrich(url: string): boolean {
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("medium.com") ||
    url.includes("substack.com")
  );
}

export function extractDomain(url: string): string | null {
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain;
  } catch {
    return null;
  }
}

export function getPrimaryUrl(source: SourceDTO): string | null {
  const metadata = source?.metadata as Record<string, unknown> | undefined;
  const url = metadata?.url;
  if (typeof url === "string" && url.trim()) return url;
  return null;
}

export function buildMetadataBadges(source: SourceDTO): string[] {
  const badges: string[] = [];
  const type = source?.type as SourceType | undefined;
  const metadata = source?.metadata as Record<string, unknown> | undefined;

  // Don't show type label since icon already indicates type

  // Show author/show/channel name first
  if (source.author) {
    badges.push(source.author);
  }

  if (source.published_at) {
    const formattedDate = formatDateUTC(source.published_at, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (formattedDate) {
      badges.push(`Published ${formattedDate}`);
    }
  }

  if (!type) return badges;

  switch (type) {
    case "video": {
      const domain = metadata?.url ? extractDomain(String(metadata.url)) : null;
      if (domain) badges.push(domain);
      // Use top-level duration field (extracted from metadata by backend)
      if (typeof source.duration === "number") {
        badges.push(formatDuration(source.duration));
      }
      break;
    }
    case "book": {
      if (metadata && typeof metadata.pages === "number") {
        badges.push(`${metadata.pages} pages`);
      }
      break;
    }
    case "article": {
      const domain = metadata?.url ? extractDomain(String(metadata.url)) : null;
      if (domain) badges.push(domain);
      break;
    }
  }

  return badges;
}
