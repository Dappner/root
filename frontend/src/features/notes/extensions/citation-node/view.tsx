"use client";

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { ArrowUpRight, BookOpen, File, FileText, Mic, Video } from "lucide-react";
import { Link } from "@/lib/nav";

function renderIcon(type: string): React.ReactNode {
  const cls = "h-3 w-3";
  switch (type) {
    case "book":    return <BookOpen className={cls} />;
    case "video":   return <Video className={cls} />;
    case "podcast": return <Mic className={cls} />;
    case "pdf":     return <File className={cls} />;
    default:        return <FileText className={cls} />;
  }
}

export function CitationNodeView({ node }: NodeViewProps) {
  const { citationId, sourceId, sourceTitle, sourceType } = node.attrs as {
    citationId: number;
    sourceId: number;
    sourceTitle: string;
    sourceType: string;
  };

  return (
    <NodeViewWrapper className="my-3 border-l-2 border-primary/40 pl-4 py-1">
      <NodeViewContent className="text-base italic leading-relaxed" />
      <div
        contentEditable={false}
        className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground select-none"
      >
        {renderIcon(sourceType)}
        <span>{sourceTitle}</span>
        <Link
          href={`/library/${sourceId}/highlights?quote=${citationId}`}
          className="ml-0.5 hover:text-foreground transition-colors"
        >
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </NodeViewWrapper>
  );
}
