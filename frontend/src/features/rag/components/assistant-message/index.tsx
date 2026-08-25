"use client";

import { CitationBadge } from "@/components/ai/citation-marker";
import { CitationFooter, CitationGroup } from "@/components/ai/citation-footer";
import { ShimmerLabel } from "@/components/ai/streaming-text";
import { Link } from "@/lib/nav";
import { ArrowUpRight } from "lucide-react";
import { citationHref, citationLabel, citationTone } from "../../display";
import type { AskResponse } from "../../types";
import { parseAnswer } from "../../utils";
import { AnswerText } from "./components/answer-text";

interface AssistantMessageProps {
  response: AskResponse;
  isStreaming?: boolean;
  loadingLabel?: string;
}

/** Truncates preview text without leaving a dangling ellipsis on short strings. */
function preview(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/**
 * One reference in the source footer.
 *
 * Becomes a link when the citation can be located in the library — quotes and
 * captures deep-link to the exact entry and flash it on arrival. Citations
 * without a resolvable source stay as plain text rather than rendering a link
 * that goes nowhere.
 */
function ReferenceRow({
  href,
  marker,
  children,
}: {
  href: string | null;
  marker: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="mt-0.5 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        [{marker}]
      </span>
      {children}
      {href && (
        <ArrowUpRight
          className="mt-0.5 size-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/ref:opacity-100"
          strokeWidth={1.8}
        />
      )}
    </>
  );

  if (!href) {
    return <div className="flex items-start gap-3 text-xs">{body}</div>;
  }

  return (
    <Link
      href={href}
      className="group/ref -mx-1 flex items-start gap-3 rounded px-1 py-0.5 text-xs transition-colors hover:bg-muted/40"
    >
      {body}
    </Link>
  );
}

export function AssistantMessage({ response, isStreaming, loadingLabel }: AssistantMessageProps) {
  const parsed = parseAnswer(response);
  const loadingText = (loadingLabel || "Writing answer").replace(/[.\s]+$/, "");

  const groupedCitations = parsed.citations.reduce<Record<string, typeof parsed.citations>>(
    (acc, citation) => {
      const key = citation.sourceId
        ? `source:${citation.sourceId}`
        : `unknown:${citation.citation.type}:${citation.citation.entity_id}`;
      acc[key] = acc[key] || [];
      acc[key].push(citation);
      return acc;
    },
    {},
  );

  // Stream opened but no tokens yet — show the label alone rather than an empty
  // bubble, so the answer area does not visibly reflow when text arrives.
  if (!parsed.text && isStreaming) {
    return (
      <div className="flex items-start animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="w-full max-w-3xl flex-1 pt-1">
          <div className="px-1 text-sm">
            <ShimmerLabel>{loadingText}</ShimmerLabel>
          </div>
        </div>
      </div>
    );
  }

  if (!parsed.text) return null;

  return (
    <div className="flex items-start animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="w-full max-w-3xl flex-1 space-y-3 pt-0.5 sm:space-y-4">
        <div className="max-w-none px-1">
          <AnswerText
            text={parsed.text}
            citations={parsed.citations}
            isStreaming={isStreaming}
          />
        </div>

        {/* Held back until the answer settles: a footer that grows as citations
            stream in pushes the prose around mid-read. */}
        {!isStreaming && (
          <CitationFooter count={Object.keys(groupedCitations).length} className="ml-1">
            {Object.entries(groupedCitations).map(([groupKey, citations]) => {
              const first = citations[0];
              const sourceTitle =
                first?.citation.source_title ??
                (first?.sourceId ? `source:${first.sourceId}` : "Unknown source");

              return (
                <CitationGroup
                  key={groupKey}
                  count={citations.length}
                  heading={
                    first?.sourceId ? (
                      <Link
                        href={`/library/${first.sourceId}`}
                        className="transition-colors hover:text-primary"
                      >
                        {sourceTitle}
                      </Link>
                    ) : (
                      sourceTitle
                    )
                  }
                >
                  {citations.map((ref) => {
                    const c = ref.citation;
                    const tone = citationTone(c.type);
                    const href = citationHref(c);

                    return (
                      <ReferenceRow key={ref.token} href={href} marker={ref.display}>
                        <div className="flex-1">
                          <CitationBadge tone={tone}>{citationLabel(c.type)}</CitationBadge>

                          {c.type === "takeaway" && (
                            <>
                              {c.takeaway_title && (
                                <p className="mt-1 font-medium text-foreground">
                                  {c.takeaway_title}
                                </p>
                              )}
                              {c.takeaway_body && (
                                <p className="mt-0.5 line-clamp-2 leading-relaxed text-muted-foreground">
                                  {preview(c.takeaway_body, 120)}
                                </p>
                              )}
                            </>
                          )}

                          {c.type === "source_section_summary" && (
                            <>
                              {c.section_title && (
                                <p className="mt-1 font-medium text-foreground">
                                  {c.section_title}
                                </p>
                              )}
                              {c.section_summary && (
                                <p className="mt-0.5 line-clamp-2 leading-relaxed text-muted-foreground">
                                  {preview(c.section_summary, 120)}
                                </p>
                              )}
                            </>
                          )}

                          {(c.type === "citation" ||
                            c.type === "capture" ||
                            c.type === "transcript_chunk") &&
                            c.text && (
                              <p className="mt-1 line-clamp-2 leading-relaxed text-muted-foreground">
                                &quot;{preview(c.text, 120)}&quot;
                              </p>
                            )}

                          {c.type === "capture" && c.citation_text && (
                            <div className="mt-1.5 border-l border-border pl-2">
                              {(c.citation_speaker || c.citation_context) && (
                                <div className="text-[11px] text-muted-foreground/70">
                                  {[c.citation_speaker, c.citation_context]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                              <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80">
                                &quot;{preview(c.citation_text, 140)}&quot;
                              </p>
                            </div>
                          )}
                        </div>
                      </ReferenceRow>
                    );
                  })}
                </CitationGroup>
              );
            })}
          </CitationFooter>
        )}
      </div>
    </div>
  );
}
