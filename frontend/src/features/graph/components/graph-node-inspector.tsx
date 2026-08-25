"use client";

import { Link } from "@/lib/nav";
import { memo } from "react";
import { ExternalLink, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SimNode } from "@/features/graph/lib/edge-kinds";
import type { NodeInspectorData } from "@/features/graph/hooks/use-node-inspector-data";
import { colorForSource } from "@/features/graph/lib/colors";
import { truncate } from "@/lib/utils";

interface GraphNodeInspectorProps {
  node: SimNode;
  data: NodeInspectorData;
  onClose: () => void;
  onSelectNode: (node: SimNode) => void;
  onSelectTag: (tagId: number) => void;
  // Hover preview → ask the graph to pulse + pan to the matching node. Pass
  // null to clear.
  onHoverNode?: (nodeId: string | null) => void;
}

export const GraphNodeInspector = memo(function GraphNodeInspector({
  node,
  data,
  onClose,
  onSelectNode,
  onSelectTag,
  onHoverNode,
}: GraphNodeInspectorProps) {
  const graphNode = node.node;
  const href = nodeHref(node);
  const kindLabel = graphNode.kind === "source" ? "source" : graphNode.kind;
  const title = graphNode.title || "Untitled";
  const sourceTitle =
    graphNode.kind === "source" ? null : graphNode.source_title ?? null;
  const accentColor = colorForSource(graphNode.source_id);

  const relatedToShow = data.related.slice(0, 3);
  const quotesToShow = data.quotes.slice(0, 3);
  const relatedSourcesToShow = data.relatedSources.slice(0, 5);
  const sourceTakeawaysToShow = data.sourceTakeaways.slice(0, 4);

  return (
    <aside
      className="absolute top-4 right-4 bottom-4 z-20 w-[min(380px,calc(100vw-2rem))] rounded-md border bg-card/95 backdrop-blur shadow-lg flex flex-col cursor-default"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <Badge variant="outline" className="uppercase text-[10px]">
              {kindLabel}
            </Badge>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {data.neighborCount}{" "}
              {data.neighborCount === 1 ? "link" : "links"}
            </span>
            {data.totalQuotes > 0 && graphNode.kind !== "note" && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                · {data.totalQuotes}{" "}
                {data.totalQuotes === 1 ? "quote" : "quotes"}
              </span>
            )}
          </div>
          <h2 className="text-sm font-semibold leading-snug line-clamp-3">
            {title}
          </h2>
          {(sourceTitle || data.author || data.sourceLabel) && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              {data.author && (
                <span className="text-foreground">{data.author}</span>
              )}
              {data.sourceLabel && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {data.sourceLabel}
                </Badge>
              )}
              {sourceTitle && !data.author && (
                <span className="line-clamp-1">{sourceTitle}</span>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close inspector"
          onClick={onClose}
          className="shrink-0"
        >
          <X />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-5 text-xs">
          {graphNode.kind === "citation" && graphNode.text && (
            <Section title="Quote">
              <blockquote className="border-l pl-3 text-muted-foreground italic line-clamp-6">
                {truncate(graphNode.text, 400)}
              </blockquote>
            </Section>
          )}

          {data.summary && graphNode.kind !== "citation" && (
            <Section title="Essence">
              <p className="text-muted-foreground leading-relaxed line-clamp-6">
                {truncate(data.summary, 400)}
              </p>
            </Section>
          )}

          {quotesToShow.length > 0 && (
            <Section
              title={`${data.totalQuotes} Referenced ${
                data.totalQuotes === 1 ? "Quote" : "Quotes"
              }`}
              hint={
                href && data.totalQuotes > quotesToShow.length ? (
                  <Link
                    href={href}
                    className="text-[10px] text-muted-foreground hover:text-foreground rounded border px-1.5 py-0.5"
                  >
                    View all
                  </Link>
                ) : undefined
              }
            >
              <div className="grid grid-cols-3 gap-1.5">
                {quotesToShow.map((q) => (
                  <div
                    key={q.speaker}
                    className="rounded border px-2 py-1.5 space-y-1"
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-flex items-center justify-center size-4 rounded text-[10px] font-medium"
                        style={{
                          backgroundColor: `${accentColor}30`,
                          color: accentColor,
                        }}
                      >
                        {q.count}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                      {q.speaker}
                    </div>
                  </div>
                ))}
                {data.quotes.length > quotesToShow.length && (
                  <div className="rounded border border-dashed px-2 py-1.5 flex items-center justify-center text-[10px] text-muted-foreground">
                    +{data.quotes.length - quotesToShow.length} other
                  </div>
                )}
              </div>
            </Section>
          )}

          {sourceTakeawaysToShow.length > 0 && (
            <Section
              title="Top takeaways"
              hint={
                data.sourceTakeawayTotal > sourceTakeawaysToShow.length
                  ? `${data.sourceTakeawayTotal} total`
                  : undefined
              }
            >
              <ul className="space-y-1">
                {sourceTakeawaysToShow.map((t) => (
                  <li key={t.id}>
                    <div className="rounded px-2 py-1.5 flex items-center gap-2">
                      <span
                        className="inline-block size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: accentColor }}
                      />
                      <span className="flex-1 min-w-0 block line-clamp-1 text-foreground">
                        {t.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {t.citationCount}{" "}
                        {t.citationCount === 1 ? "quote" : "quotes"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {relatedToShow.length > 0 && (
            <Section
              title="Top related takeaways"
              hint={
                data.related.length > relatedToShow.length
                  ? `View all (${data.related.length})`
                  : undefined
              }
            >
              <ul className="space-y-1">
                {relatedToShow.map((rel, i) => {
                  const score = rel.similarity.toFixed(2);
                  return (
                    <li key={`${rel.node.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => onSelectNode(rel.node)}
                        onPointerEnter={() => onHoverNode?.(rel.node.id)}
                        onPointerLeave={() => onHoverNode?.(null)}
                        className="w-full text-left rounded px-2 py-1.5 hover:bg-muted/60 transition-colors group flex items-center gap-2"
                      >
                        <span
                          className="inline-block size-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: colorForSource(
                              rel.node.node.source_id,
                            ),
                          }}
                        />
                        <span className="flex-1 min-w-0 block line-clamp-1 text-foreground">
                          {rel.node.node.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {score}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {data.themes.length > 0 && (
            <Section title="Connected themes">
              <div className="flex flex-wrap gap-1.5">
                {data.themes.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => onSelectTag(tag.id)}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-colors hover:brightness-125"
                    style={{
                      borderColor: tag.color,
                      color: tag.color,
                      backgroundColor: `${tag.color}10`,
                    }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {(data.firstSeen || data.lastEdited) && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              {data.firstSeen && (
                <div className="space-y-0.5">
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    First seen
                  </h3>
                  <p className="text-[11px]">{formatDate(data.firstSeen)}</p>
                </div>
              )}
              {data.lastEdited && (
                <div className="space-y-0.5">
                  <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Last edited
                  </h3>
                  <p className="text-[11px]">{formatDate(data.lastEdited)}</p>
                </div>
              )}
            </div>
          )}

          {data.linkedNoteCount > 0 && (
            <Section title="Notes">
              <p className="text-[11px] text-muted-foreground">
                {data.linkedNoteCount}{" "}
                {data.linkedNoteCount === 1 ? "note links" : "notes link"} here
              </p>
            </Section>
          )}

          {relatedSourcesToShow.length > 0 && (
            <Section
              title="Connected sources"
              hint={
                data.relatedSources.length > relatedSourcesToShow.length
                  ? `${data.relatedSources.length} total`
                  : undefined
              }
            >
              <ul className="space-y-1">
                {relatedSourcesToShow.map((rel) => (
                  <li key={rel.node.id}>
                    <button
                      type="button"
                      onClick={() => onSelectNode(rel.node)}
                      onPointerEnter={() => onHoverNode?.(rel.node.id)}
                      onPointerLeave={() => onHoverNode?.(null)}
                      className="w-full text-left rounded px-2 py-1.5 hover:bg-muted/60 transition-colors group flex items-start gap-2"
                    >
                      <span
                        className="mt-1.5 inline-block size-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: colorForSource(
                            rel.node.node.source_id,
                          ),
                        }}
                      />
                      <span className="flex-1 min-w-0 space-y-0.5">
                        <span className="block line-clamp-2 text-foreground">
                          {rel.node.node.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          jaccard {rel.jaccard.toFixed(2)} ·{" "}
                          {rel.shared_tag_ids.length} shared{" "}
                          {rel.shared_tag_ids.length === 1 ? "tag" : "tags"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </ScrollArea>

      <div className="border-t px-4 py-3 flex items-center gap-2">
        {href && (
          <Button
            nativeButton={false}
            render={<Link href={href} />}
            variant="outline"
            size="sm"
          >
            <ExternalLink />
            Open
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Clear focus
        </Button>
      </div>
    </aside>
  );
});

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </h3>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nodeHref(node: SimNode): string | null {
  const graphNode = node.node;
  if (graphNode.kind === "source") return `/library/${graphNode.source_id}`;
  if (graphNode.kind === "takeaway" && graphNode.source_id != null) {
    return `/library/${graphNode.source_id}/takeaways/${graphNode.entity_id}`;
  }
  if (graphNode.kind === "note") return `/notes/${graphNode.entity_id}`;
  if (graphNode.kind === "citation" && graphNode.source_id != null) {
    return `/library/${graphNode.source_id}/highlights`;
  }
  return null;
}
