"use client";

import { useSources } from "@/features/sources/hooks/sources";
import { useMemo } from "react";

interface UserMessageProps {
  question: string;
}

export function UserMessage({ question }: UserMessageProps) {
  const { data: sourcesList } = useSources();

  // Parse question to render <source-id:N> as chips
  const renderedQuestion = useMemo(() => {
    const sources = sourcesList?.sources ?? [];
    const parts: React.ReactNode[] = [];
    const sourceIdRegex = /<source-id:(\d+)>/g;
    let lastIndex = 0;
    let match;

    while ((match = sourceIdRegex.exec(question)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(question.slice(lastIndex, match.index));
      }

      // Find the source for this ID
      const sourceId = parseInt(match[1], 10);
      const source = sources.find((s) => s.id === sourceId);

      if (source) {
        parts.push(
          <span
            key={`source-${sourceId}-${match.index}`}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20"
          >
            @{source.title ?? "Untitled Source"}
          </span>
        );
      } else {
        // Fallback if source not found
        parts.push(`<source-id:${sourceId}>`);
      }

      lastIndex = sourceIdRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < question.length) {
      parts.push(question.slice(lastIndex));
    }

    return parts.length > 0 ? parts : question;
  }, [question, sourcesList?.sources]);

  return (
    <div className="flex justify-end animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex-1 max-w-2xl flex justify-end w-full">
        <div className="bg-gradient-to-br from-[#1E3A2F] to-[#14261F] border border-[#2D4A3E] text-slate-100 rounded-2xl rounded-br-none px-5 py-3.5 shadow-xl">
          <p className="text-sm sm:text-[15px] leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {renderedQuestion}
          </p>
        </div>
      </div>
    </div>
  );
}
