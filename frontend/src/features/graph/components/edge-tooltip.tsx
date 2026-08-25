"use client";

import {
  EDGE_KIND,
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import { truncate } from "@/lib/utils";

// Coords are relative to the canvas container (CSS pixels) so the overlay
// can position itself with top/left directly.
export interface EdgeTooltipState {
  x: number;
  y: number;
  link: SimLink;
}

interface EdgeTooltipProps {
  state: EdgeTooltipState;
  tagLabelById: Map<number, string>;
}

export function EdgeTooltip({ state, tagLabelById }: EdgeTooltipProps) {
  const { x, y, link } = state;
  const s = link.source as SimNode;
  const tg = link.target as SimNode;
  const sourceTitle = typeof s === "object" ? s.node.title : "";
  const targetTitle = typeof tg === "object" ? tg.node.title : "";

  let kindLabel: string;
  let detail: React.ReactNode;
  switch (link.edge_type) {
    case EDGE_KIND.Structural: {
      const count = link.shared_citation_ids?.length ?? 0;
      kindLabel = "Shared citation";
      detail = (
        <span>
          {count === 1
            ? "Both reference the same quote"
            : `Share ${count} quotes`}
        </span>
      );
      break;
    }
    case EDGE_KIND.Semantic:
      kindLabel = "Semantic similarity";
      detail = (
        <span>
          Cosine{" "}
          <span className="font-mono tabular-nums">
            {link.similarity.toFixed(2)}
          </span>
        </span>
      );
      break;
    case EDGE_KIND.Tag: {
      const ids = link.shared_tag_ids ?? [];
      const labels = ids.map((id) => tagLabelById.get(id) ?? `#${id}`);
      kindLabel = "Shared tags";
      detail = (
        <div className="space-y-1">
          <div>
            <span className="font-mono tabular-nums">
              {link.similarity.toFixed(2)}
            </span>{" "}
            jaccard
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      );
      break;
    }
    default:
      return null;
  }

  const OFFSET = 14;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border bg-popover/95 backdrop-blur shadow-lg px-3 py-2 text-xs max-w-xs space-y-1"
      style={{ left: x + OFFSET, top: y + OFFSET }}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {kindLabel}
      </div>
      <div className="text-foreground">{detail}</div>
      {(sourceTitle || targetTitle) && (
        <div className="text-[10px] text-muted-foreground border-t pt-1 mt-1">
          <div className="truncate">{truncate(sourceTitle, 40)}</div>
          <div className="text-center text-muted-foreground/60">↕</div>
          <div className="truncate">{truncate(targetTitle, 40)}</div>
        </div>
      )}
    </div>
  );
}
