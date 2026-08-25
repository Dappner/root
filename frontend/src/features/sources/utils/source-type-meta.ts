import { BookOpen, File, FileText, Mic, Video, type LucideIcon } from "lucide-react";
import type { SourceType } from "@/features/sources/types";
import { sourceTypeConfig } from "@/features/sources/utils/metadata";

export type SourceTypeMeta = {
  value: SourceType;
  label: string;
  icon: LucideIcon;
};

export const sourceTypeMeta: Record<SourceType, SourceTypeMeta> = {
  book: {
    value: "book",
    label: sourceTypeConfig.book.label,
    icon: BookOpen,
  },
  video: {
    value: "video",
    label: sourceTypeConfig.video.label,
    icon: Video,
  },
  article: {
    value: "article",
    label: sourceTypeConfig.article.label,
    icon: FileText,
  },
  podcast: {
    value: "podcast",
    label: sourceTypeConfig.podcast.label,
    icon: Mic,
  },
  pdf: {
    value: "pdf",
    label: sourceTypeConfig.pdf.label,
    icon: File,
  },
};

export const sourceTypes: SourceTypeMeta[] = Object.values(sourceTypeMeta);

export function getSourceTypeMeta(type?: SourceType | string): SourceTypeMeta {
  if (type && type in sourceTypeMeta) {
    return sourceTypeMeta[type as SourceType];
  }
  return sourceTypeMeta.article;
}

export function getSourceIcon(type?: SourceType | string): LucideIcon {
  return getSourceTypeMeta(type).icon;
}

export function getSourceLabel(type?: SourceType | string): string {
  return getSourceTypeMeta(type).label;
}
