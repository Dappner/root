"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCapturesBySource } from "@/features/captures/hooks";
import { useCitationsBySource } from "@/features/sources/hooks/citations";
import { useSource } from "@/features/sources/hooks/sources";
import { formatCitationLocation } from "@/features/sources/utils/location";
import { NeighborhoodGraph } from "@/features/graph/components/neighborhood-graph";
import { ParallelsPanel } from "@/features/takeaways/components/parallels-panel";
import { useTakeaway } from "@/features/takeaways/hooks";
import { formatDateUTC } from "@/lib/utils/date";
import {
  BookOpen,
  Edit,
  Loader2,
  Quote as QuoteIcon,
} from "lucide-react";
import { Link } from "@/lib/nav";
import type { ReactNode } from "react";

interface TakeawayDetailViewProps {
  sourceId: number;
  takeawayId: number;
}

export function TakeawayDetailView({ sourceId, takeawayId }: TakeawayDetailViewProps) {
  const { data: source, isPending: sourceLoading } = useSource(sourceId);
  const {
    data: takeaway,
    isPending: takeawayLoading,
    isError: takeawayError,
  } = useTakeaway(sourceId, takeawayId);
  const { data: allCaptures } = useCapturesBySource(sourceId);
  const { data: allCitations } = useCitationsBySource(sourceId);

  // Show loading state while fetching
  if (sourceLoading || takeawayLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show not found only after loading completes and data is missing
  if (!source || !takeaway) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          {takeawayError ? "Takeaway not found" : "Loading..."}
        </p>
      </div>
    );
  }

  const linkedCitations =
    allCitations?.filter((c) =>
      takeaway.citations?.some((tc) => tc.id === c.id)
    ) ?? [];

  const linkedCaptures =
    allCaptures?.filter((c) =>
      takeaway.captures?.some((tc) => tc.id === c.id)
    ) ?? [];

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Library", href: "/library" },
              {
                label: source.title
                  ? source.title.length > 20
                    ? `${source.title.slice(0, 20)}...`
                    : source.title
                  : "...",
                href: `/library/${sourceId}`,
              },
              {
                label: takeaway.title
                  ? takeaway.title.length > 20
                    ? `${takeaway.title.slice(0, 20)}...`
                    : takeaway.title
                  : "Takeaway",
              },
            ]}
          />
        }
        actions={
          <Link href={`/library/${sourceId}/takeaways/${takeawayId}/edit`}>
            <Button>
              <Edit className="w-4 h-4 mr-2" />
              Edit Takeaway
            </Button>
          </Link>
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
          <div className="space-y-12 min-w-0">
            {/* Main Takeaway Content */}
            <section>
              <h1 className="text-3xl font-bold tracking-tight mb-6">
                {takeaway.title}
              </h1>
              <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed text-muted-foreground">
                {takeaway.body}
              </div>

              {/* Counters + timestamps strip: at-a-glance summary anchored
                  to this takeaway, with creation/edit metadata trailing on
                  the right where it stays out of the reading flow. */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-8 pt-6 border-t">
                <CounterItem
                  icon={<QuoteIcon className="w-4 h-4" />}
                  value={linkedCitations.length}
                  label="Referenced quotes"
                />
                <CounterItem
                  icon={<BookOpen className="w-4 h-4" />}
                  value={1}
                  label="Source"
                />
                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Created {formatDateUTC(takeaway.created_at, { dateStyle: "medium" })}</span>
                  {takeaway.updated_at !== takeaway.created_at && (
                    <>
                      <span>•</span>
                      <span>Last edited {formatDateUTC(takeaway.updated_at, { dateStyle: "medium" })}</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Linked Citations (Quotes) */}
            {linkedCitations.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
                  <QuoteIcon className="w-4 h-4" />
                  Referenced Quotes ({linkedCitations.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {linkedCitations.map((citation) => {
                    const locationLabel = formatCitationLocation(citation.location);
                    return (
                      <Card key={citation.id} className="bg-muted/30 border-muted">
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">
                              {citation.info_type}
                            </span>
                            {citation.speaker && (
                              <span className="text-xs text-muted-foreground font-semibold">
                                {citation.speaker}
                              </span>
                            )}
                            {locationLabel && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {locationLabel}
                              </span>
                            )}
                          </div>

                          <blockquote className="text-base italic text-foreground mb-3">
                            &ldquo;{citation.text}&rdquo;
                          </blockquote>

                          {citation.context && (
                            <p className="text-sm text-muted-foreground border-l-2 pl-3 py-1 bg-background/50 rounded-r">
                              <span className="font-semibold text-xs uppercase tracking-wider block mb-1">Context</span>
                              {citation.context}
                            </p>
                          )}
                        </CardContent>
                      </Card>);
                  })}
                </div>
              </section>
            )}

            {/* Linked Captures (Reflections) */}
            {linkedCaptures.length > 0 && (
              <section className="space-y-4 border-t pt-8">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                  Related Reflections ({linkedCaptures.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {linkedCaptures.map((capture) => (
                    <Card key={capture.id} className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/50">
                      <CardContent className="pt-6">
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">
                          {capture.text}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right rail: cross-source parallels (takeaway → note step of the
              synthesis ladder). Stacks below the main content on mobile. */}
          {/* Right rail: fixed to the viewport rather than scrolling with the
              page body. Independent overflow handler so the rail can scroll
              its own contents when needed, but the body remains primary.
              top-20 accounts for the PageHeader bar height (~4rem). */}
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:h-[calc(100vh-6rem)]">
            <div className="h-full overflow-y-auto space-y-8 pr-1">
              <NeighborhoodGraph centerId={`takeaway:${takeawayId}`} />
              <ParallelsPanel takeawayId={takeawayId} />
            </div>
          </aside>
          {/* Mobile: rail stacks below as a normal section, no fixed positioning. */}
          <div className="lg:hidden space-y-8">
            <NeighborhoodGraph centerId={`takeaway:${takeawayId}`} />
            <ParallelsPanel takeawayId={takeawayId} />
          </div>
        </div>
      </div>
    </>
  );
}

function CounterItem({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
