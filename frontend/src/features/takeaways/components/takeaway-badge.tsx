"use client";

import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import { routes } from "@/lib/routes";
import { Link } from "@/lib/nav";

interface TakeawayBadgeProps {
  takeaways: SourceTakeawayDTO[];
  sourceId?: number;
}

/**
 * Badge showing which takeaway(s) a citation belongs to.
 * Links to the takeaway (single) or the takeaways index (multiple).
 */
export function TakeawayBadge({ takeaways, sourceId }: TakeawayBadgeProps) {
  if (!takeaways || takeaways.length === 0) return null;

  const label =
    takeaways.length === 1
      ? takeaways[0].title || "In takeaway"
      : `In ${takeaways.length} takeaways`;

  if (!sourceId) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        {label}
      </span>
    );
  }

  const href =
    takeaways.length === 1
      ? routes.sourceTakeaway(sourceId, takeaways[0].id)
      : routes.sourceTakeaways(sourceId);

  return (
    <Link
      href={href}
      className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer"
    >
      {label}
    </Link>
  );
}
