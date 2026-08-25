"use client";

import { Link } from "@/lib/nav";

import { useDialog } from "@/components/dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import { ArrowRight, FileText, Plus } from "lucide-react";
import type { HomePrimaryItem } from "../types";

type PrimaryFocusCardProps = {
  primary: HomePrimaryItem | null | undefined;
  isLoading?: boolean;
};

function getDestinationHref(primary: HomePrimaryItem): string {
  if (primary.kind === "note") {
    return `/notes/${primary.note?.id}`;
  }

  const sourceId = primary.source?.id;
  if (!sourceId) return "/library";
  const sourceType = primary.source?.type;

  const activityType = primary.activity_type;

  if (activityType === "takeaway") {
    return `/library/${sourceId}/takeaways`;
  }
  if (activityType === "note") {
    // source-linked note
    return `/library/${sourceId}/highlights`;
  }

  // citation or capture — go to section
  const sectionId = primary.section_id;
  if (sectionId) {
    return `/library/${sourceId}/sections/${sectionId}`;
  }

  if (sourceType === "podcast" || sourceType === "video") {
    return `/library/${sourceId}/transcript`;
  }

  if (sourceType === "pdf") {
    return `/library/${sourceId}`;
  }

  // no section → unsorted for books, otherwise return to source
  if (sourceType && sourceType !== "book") {
    return `/library/${sourceId}`;
  }

  return `/library/${sourceId}/sections/unsorted`;
}

function getCtaLabel(primary: HomePrimaryItem): string {
  if (primary.kind === "note") return "Continue writing";

  const activityType = primary.activity_type;
  if (activityType === "takeaway") return "Continue in Takeaways";

  const sectionTitle = primary.section_title;
  if (sectionTitle) return `Continue in ${sectionTitle}`;

  const sourceType = primary.source?.type;
  if (sourceType === "podcast" || sourceType === "video") {
    return "Continue in Transcript";
  }
  if (sourceType === "pdf") {
    return "Continue in Source";
  }
  if (sourceType && sourceType !== "book") {
    return "Continue in Source";
  }

  return "Continue in Unsorted";
}

export function PrimaryFocusCard({ primary, isLoading }: PrimaryFocusCardProps) {
  const { openDialog } = useDialog();

  if (isLoading) {
    return (
      <div className="border rounded-xl p-5 md:p-8 bg-accent/5 animate-pulse h-40" />
    );
  }

  if (!primary) {
    return (
      <div className="border rounded-xl p-8 bg-accent/5 hover:bg-accent/10 transition-colors">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Capture one thing you&apos;ve read or watched recently
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              What&apos;s still rattling around in your head?
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => openDialog(CreateSourceDialog)} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Add source
            </Button>
            <Button variant="outline" size="lg" nativeButton={false} render={
              <Link href={routes.library}>
                Browse library
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            }>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isNote = primary.kind === "note";
  const source = primary.source;
  const note = primary.note;
  const lastActive = primary.last_activity_at ? timeAgo(primary.last_activity_at) : null;
  const href = getDestinationHref(primary);
  const ctaLabel = getCtaLabel(primary);

  return (
    <div className="border rounded-xl p-5 md:p-8 bg-accent/5 hover:bg-accent/10 transition-colors">
      <div className="flex flex-col md:flex-row items-start gap-6">
        {/* Thumbnail */}
        {isNote ? (
          <div className="w-full h-32 md:size-32 shrink-0 rounded-lg flex items-center justify-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <FileText className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground" />
          </div>
        ) : source?.image_url ? (
          <div className="w-full md:w-48 shrink-0 rounded-lg overflow-hidden border bg-secondary transition-all hover:shadow-lg">
            <img
              src={source.image_url}
              alt={source.title}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full h-32 md:size-32 shrink-0 rounded-lg flex items-center justify-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <SourceIcon
              type={source?.type ?? "book"}
              className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground hover:text-primary transition-colors"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Continue your thinking
            </p>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                {isNote ? (note?.title || "Untitled note") : (source?.title ?? "")}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {!isNote && source?.type && (
                  <Badge variant="secondary" className="text-xs capitalize font-medium">
                    {source.type}
                  </Badge>
                )}
                {isNote && (
                  <Badge variant="secondary" className="text-xs capitalize font-medium">
                    {note?.kind ?? "note"}
                  </Badge>
                )}
                {lastActive && (
                  <span className="text-sm text-muted-foreground">Last worked on {lastActive}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button nativeButton={false} render={
              <Link href={href}>
                {ctaLabel}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            } size="lg" className="w-full md:w-auto">
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
