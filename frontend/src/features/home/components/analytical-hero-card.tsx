"use client";

import { Link } from "@/lib/nav";
import { ArrowRight, Clock, MessageSquare, Play } from "lucide-react";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import type { HomePrimaryItem } from "../types";

interface AnalyticalHeroCardProps {
  primary: HomePrimaryItem | null | undefined;
  isLoading?: boolean;
}

function getDestinationHref(primary: HomePrimaryItem): string {
  if (primary.kind === "note") return routes.note(primary.note?.id ?? "");
  const sourceId = primary.source?.id;
  if (!sourceId) return routes.library;
  const sourceType = primary.source?.type;
  const activityType = primary.activity_type;
  if (activityType === "takeaway") return routes.sourceTakeaways(sourceId);
  if (activityType === "note") return routes.sourceHighlights(sourceId);
  const sectionId = primary.section_id;
  if (sectionId) return routes.sourceSection(sourceId, sectionId);
  if (sourceType === "podcast" || sourceType === "video")
    return routes.sourceTranscript(sourceId);
  if (sourceType === "pdf") return routes.source(sourceId);
  if (sourceType && sourceType !== "book") return routes.source(sourceId);
  return routes.sourceSectionUnsorted(sourceId);
}

export function AnalyticalHeroCard({ primary, isLoading }: AnalyticalHeroCardProps) {
  if (isLoading) {
    return <div className="rounded-xl bg-[#132a1e] animate-pulse h-52" />;
  }

  if (!primary) {
    return (
      <div className="rounded-xl bg-[#132a1e] text-white/50 p-6 flex items-center justify-center text-sm">
        No active source yet. Add something to your library to get started.
      </div>
    );
  }

  const source = primary.source;
  const note = primary.note;
  const isNote = primary.kind === "note";
  const title = isNote ? (note?.title ?? "Untitled note") : (source?.title ?? "");
  const subtitle = !isNote && source?.author ? source.author : null;
  const lastActive = primary.last_activity_at ? timeAgo(primary.last_activity_at) : null;
  const href = getDestinationHref(primary);
  const hasMedia = source?.type === "podcast" || source?.type === "video";
  const totalCaptures = (source?.capture_count ?? 0) + (source?.citation_count ?? 0);
  const duration = source?.duration; // seconds
  const currentPosition = (() => {
    const meta = source?.metadata as { current_position?: unknown } | undefined;
    const pos = meta?.current_position;
    return typeof pos === "number" && Number.isFinite(pos) && pos > 0 ? pos : 0;
  })();
  const remainingSecs = duration ? Math.max(0, duration - currentPosition) : null;
  const remainingMins = remainingSecs != null ? Math.round(remainingSecs / 60) : null;

  const anchorParts: string[] = [];
  if (isNote) {
    const wordCount = note?.word_count ?? 0;
    const citationCount = note?.citation_count ?? 0;
    if (wordCount > 0) {
      anchorParts.push(`${wordCount.toLocaleString()} word${wordCount !== 1 ? "s" : ""}`);
    }
    if (citationCount > 0) {
      anchorParts.push(`${citationCount} citation${citationCount !== 1 ? "s" : ""} referenced`);
    }
  } else {
    if (remainingMins) anchorParts.push(`${remainingMins} min remaining`);
    if (totalCaptures > 0) anchorParts.push(`${totalCaptures} highlight${totalCaptures !== 1 ? "s" : ""}`);
  }

  const notePreview = note?.preview?.trim() ?? "";

  return (
    <div className="rounded-xl bg-[#132a1e] text-white p-5 flex gap-5 items-stretch">
      {/* Text content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Top: label + title + author */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#52b788]">
            {hasMedia ? "Continue listening" : isNote ? "Continue writing" : "Continue reading"}
          </p>
          <h2 className="text-xl font-semibold leading-snug tracking-tight line-clamp-3">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-white/50">{subtitle}</p>
          )}
        </div>

        {/* Note body preview — trailing text with faded top edge */}
        {isNote && notePreview && (
          <div
            className="relative text-sm leading-relaxed text-white/55 line-clamp-5 flex-1"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 28%, black 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 28%, black 100%)",
            }}
          >
            {notePreview}
          </div>
        )}

        {/* Bottom: anchor line + last active + actions */}
        <div className="space-y-3 mt-auto">
          <div className="flex items-center gap-3 text-xs text-white/35 flex-wrap">
            {lastActive && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isNote ? `Edited ${lastActive}` : `Last active ${lastActive}`}
              </span>
            )}
            {anchorParts.length > 0 && (
              <>
                {lastActive && <span className="text-white/20">·</span>}
                <span>{anchorParts.join(" · ")}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium bg-[#2d6a4f] text-white hover:bg-[#3a8c66] transition-colors"
            >
              {hasMedia && <Play className="h-3.5 w-3.5" />}
              {hasMedia ? "Resume" : isNote ? "Continue" : "Open"}
            </Link>
            {!isNote && (
              <Link
                href={source?.id ? `/library/${source.id}` : "/library"}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Open source
              </Link>
            )}
            <Link
              href={routes.ask}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Root
            </Link>
          </div>
        </div>
      </div>

      {/* Right rail: source thumbnail (notes have no thumbnail — preview fills the card) */}
      {!isNote && (
        <div className="shrink-0 w-36 self-stretch">
          {source?.image_url ? (
            <img
              src={source.image_url}
              alt={source.title}
              className="w-full h-full rounded-lg object-cover border border-white/10"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full rounded-lg flex items-center justify-center bg-white/10">
              <SourceIcon type={source?.type ?? "book"} className="h-10 w-10 opacity-30" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
