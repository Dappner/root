"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { MediaPlayerDock } from "@/features/sources/components/media-player-controls";
import SourceHeader from "@/features/sources/components/source-header";
import { SourcePdfPanel } from "@/features/sources/components/source-pdf-panel";
import { SourceRouteActions } from "@/features/sources/components/source-route-actions";
import { SourceRouteHotkeys } from "@/features/sources/components/source-route-hotkeys";
import { VideoPlayerScope } from "@/features/sources/components/video-player-scope";
import { useSource } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

interface SourceRouteLayoutProps {
  itemId: string;
  breadcrumbPageLabel?: string;
  showPageHeader?: boolean;
  showSourceHeader?: boolean;
  showScrollToTop?: boolean;
  showMediaDock?: boolean;
  headerActions?: (args: { id: number; source: SourceDTO }) => ReactNode;
  children: (args: { id: number; source: SourceDTO }) => ReactNode;
}

export function SourceRouteLayout({
  itemId,
  breadcrumbPageLabel,
  showPageHeader = true,
  showSourceHeader = false,
  showScrollToTop = true,
  showMediaDock = true,
  headerActions,
  children,
}: SourceRouteLayoutProps) {
  const id = Number(itemId);
  const { data: source, isLoading } = useSource(id);

  if (isLoading || !source) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-8 flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const body = (
    <>
      <SourceRouteHotkeys source={source} />
      {showPageHeader && (
        <PageHeader
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Library", href: "/library" },
                {
                  label: source.title ?? "Not Found",
                  href: breadcrumbPageLabel ? `/library/${source.id}` : undefined,
                },
                ...(breadcrumbPageLabel ? [{ label: breadcrumbPageLabel }] : []),
              ]}
            />
          }
          actions={
            <>
              {headerActions?.({ id, source })}
              <SourceRouteActions source={source} />
            </>
          }
        />
      )}

      {showScrollToTop && <ScrollToTopButton />}

      <div
        className={cn(
          "container mx-auto px-4 space-y-4 md:space-y-8 pb-8",
          showSourceHeader || showMediaDock ? "pt-2 md:pt-4" : "pt-0 md:pt-2",
        )}
      >
        {showSourceHeader && <SourceHeader sourceId={source.id} />}
        {showMediaDock && source.type === "video" && <MediaPlayerDock source={source} />}
        {children({ id, source })}
      </div>

      <SourcePdfPanel source={source} />
    </>
  );

  return source.type === "video" ? (
    <VideoPlayerScope source={source}>{body}</VideoPlayerScope>
  ) : (
    body
  );
}
