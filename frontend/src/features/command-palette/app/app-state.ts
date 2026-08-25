"use client";

import { useParams, usePathname } from "@/lib/nav";

export interface AppState {
  pathname: string | null;
  sourceId: number | undefined;
  collectionId: number | undefined;
  currentSectionId: string | undefined;
}

export function useAppState(): AppState {
  const pathname = usePathname();
  const params = useParams();

  const itemId = getSingleParam(params.itemId);
  const collectionId = getSingleParam(params.collectionId);
  const sectionId = getSingleParam(params.sectionId);

  const sourceId =
    pathname?.startsWith("/library/") && itemId ? Number(itemId) : undefined;
  const collectionIdNum =
    pathname?.startsWith("/library/collections/") && collectionId
      ? Number(collectionId)
      : undefined;

  return {
    pathname,
    sourceId,
    collectionId: collectionIdNum,
    currentSectionId: sectionId,
  };
}

function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
