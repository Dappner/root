"use client";

import { StreamingCaret } from "@/components/ai/streaming-text";
import type { CitationReference } from "@/features/rag/types";
import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationChip } from "./citation-chip";

interface AnswerTextProps {
  text: string;
  citations: CitationReference[];
  /** Appends a blinking caret to the final block while deltas are arriving. */
  isStreaming?: boolean;
}

function parseCitationTags(text: string): Array<{ type: "text" | "citation"; content: string }> {
  const parts: Array<{ type: "text" | "citation"; content: string }> = [];
  const regex = /<([\d,\s]+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    const tokens = match[1].split(",").map((token) => token.trim());
    for (const token of tokens) {
      if (token) {
        parts.push({ type: "citation", content: token });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

/**
 * Private-use codepoint appended to streaming markdown so the caret can ride
 * the final text node. Threading a flag through every renderer would require
 * knowing which block renders last, which markdown does not tell us; a sentinel
 * in the text survives parsing and lands exactly where the prose ends.
 */
const CARET_SENTINEL = "";

function processChildren(children: React.ReactNode, citations: CitationReference[]): React.ReactNode {
  if (typeof children === "string") {
    if (children.includes(CARET_SENTINEL)) {
      const [before] = children.split(CARET_SENTINEL);
      return (
        <>
          {processChildren(before, citations)}
          <StreamingCaret />
        </>
      );
    }

    const parts = parseCitationTags(children);
    return (
      <>
        {parts.map((part, idx) =>
          part.type === "citation" ? (
            <CitationChip key={`${part.content}-${idx}`} citationId={part.content} citations={citations} />
          ) : (
            <Fragment key={idx}>{part.content}</Fragment>
          )
        )}
      </>
    );
  }

  if (Array.isArray(children)) {
    return children.map((child, idx) => (
      <Fragment key={idx}>{processChildren(child, citations)}</Fragment>
    ));
  }

  return children;
}

export function AnswerText({ text, citations, isStreaming }: AnswerTextProps) {
  // Only append while streaming — a trailing sentinel in a settled answer would
  // render a caret that never goes away.
  const source = isStreaming ? `${text}${CARET_SENTINEL}` : text;

  return (
    <div className="text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 text-foreground/90">
              {processChildren(children, citations)}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {processChildren(children, citations)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">
              {processChildren(children, citations)}
            </em>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted/60 px-1 py-0.5 text-xs font-mono text-foreground/90">{children}</code>
          ),
          ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1.5 text-foreground/90">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1.5 text-foreground/90">{children}</ol>,
          li: ({ children }) => (
            <li className="pl-1">
              {processChildren(children, citations)}
            </li>
          ),
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-bold text-foreground first:mt-0">
              {processChildren(children, citations)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3 mb-2 text-base font-bold text-foreground first:mt-0">
              {processChildren(children, citations)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0">
              {processChildren(children, citations)}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-foreground/60">
              {processChildren(children, citations)}
            </blockquote>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
