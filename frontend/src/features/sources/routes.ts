"use client";

import type { SourceDTO } from "@/features/sources/types";
import { routes } from "@/lib/routes";

export type SourceRouteKey =
  | "overview"
  | "takeaways"
  | "highlights"
  | "notes"
  | "transcript"
  | "reflect";

export interface SourceRouteItem {
  key: SourceRouteKey;
  label: string;
  href: string;
}

const SOURCE_ROUTE_LABELS: Record<SourceRouteKey, string> = {
  overview: "Overview",
  takeaways: "Takeaways",
  highlights: "Highlights",
  notes: "Notes",
  transcript: "Transcript",
  reflect: "Reflect",
};

export function getSourceRouteHref(itemId: string | number, route: SourceRouteKey) {
  switch (route) {
    case "overview":
      return routes.source(itemId);
    case "takeaways":
      return routes.sourceTakeaways(itemId);
    case "highlights":
      return routes.sourceHighlights(itemId);
    case "notes":
      return routes.sourceNotes(itemId);
    case "transcript":
      return routes.sourceTranscript(itemId);
    case "reflect":
      return `/library/${itemId}/reflect`;
  }
}

export function getSourceRouteItems(
  source: Pick<SourceDTO, "id" | "type" | "status">,
): SourceRouteItem[] {
  const itemId = String(source.id);
  const items: SourceRouteItem[] = [
    {
      key: "overview",
      label: SOURCE_ROUTE_LABELS.overview,
      href: getSourceRouteHref(itemId, "overview"),
    },
    {
      key: "takeaways",
      label: SOURCE_ROUTE_LABELS.takeaways,
      href: getSourceRouteHref(itemId, "takeaways"),
    },
    {
      key: "highlights",
      label: SOURCE_ROUTE_LABELS.highlights,
      href: getSourceRouteHref(itemId, "highlights"),
    },
    {
      key: "notes",
      label: SOURCE_ROUTE_LABELS.notes,
      href: getSourceRouteHref(itemId, "notes"),
    },
  ];

  if (source.type === "podcast" || source.type === "video") {
    items.push({
      key: "transcript",
      label: SOURCE_ROUTE_LABELS.transcript,
      href: getSourceRouteHref(itemId, "transcript"),
    });
  }

  if (source.type !== "pdf" && (source.status === "reflecting" || source.status === "done")) {
    items.push({
      key: "reflect",
      label: SOURCE_ROUTE_LABELS.reflect,
      href: getSourceRouteHref(itemId, "reflect"),
    });
  }

  return items;
}

export function getActiveSourceRoute(
  pathname: string,
  source: Pick<SourceDTO, "id" | "type" | "status">,
): SourceRouteKey {
  const prefix = `/library/${source.id}`;
  const nestedPath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";

  if (nestedPath.startsWith("/highlights")) return "highlights";
  if (nestedPath.startsWith("/sections")) return "highlights";
  if (nestedPath.startsWith("/notes")) return "notes";
  if (nestedPath.startsWith("/transcript")) return "transcript";
  if (nestedPath.startsWith("/reflect")) return "reflect";
  if (nestedPath === "/takeaways") return "takeaways";

  return "overview";
}
