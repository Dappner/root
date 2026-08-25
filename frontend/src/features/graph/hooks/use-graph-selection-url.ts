"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";

import { useTags } from "@/features/tags/hooks";

// Single `?node=kind:value` query param drives the inspector + tag sheet so
// graph selections are deep-linkable / shareable / browser-back friendly.
//
// Format:
//   ?node=source:42
//   ?node=takeaway:99
//   ?node=note:7
//   ?node=citation:17
//   ?node=tag:productivity   (tag uses slug, all others use numeric id)
//
// Tag slugs are resolved via the existing useTags() cache; until tags load
// the tag selection just stays null and the sheet doesn't open.
type Selection =
  | { kind: "node"; nodeId: string }
  | { kind: "tag"; tagId: number }
  | null;

interface UseGraphSelectionUrlResult {
  selectedNodeId: string | null;
  selectedTagId: number | null;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
}

export function useGraphSelectionUrl(): UseGraphSelectionUrlResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: tags } = useTags();

  const tagsBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tags ?? []) m.set(t.slug, t.id);
    return m;
  }, [tags]);

  const tagsById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tags ?? []) m.set(t.id, t.slug);
    return m;
  }, [tags]);

  const raw = searchParams.get("node");

  const { selectedNodeId, selectedTagId } = useMemo(() => {
    if (!raw) return { selectedNodeId: null, selectedTagId: null };
    const colonIdx = raw.indexOf(":");
    if (colonIdx < 1) return { selectedNodeId: null, selectedTagId: null };
    const kind = raw.slice(0, colonIdx);
    const value = raw.slice(colonIdx + 1);
    if (kind === "tag") {
      const id = tagsBySlug.get(value);
      return { selectedNodeId: null, selectedTagId: id ?? null };
    }
    if (
      kind === "source" ||
      kind === "takeaway" ||
      kind === "note" ||
      kind === "citation"
    ) {
      // Reuse the same `kind:value` shape SimNode ids use — no remapping.
      return { selectedNodeId: `${kind}:${value}`, selectedTagId: null };
    }
    return { selectedNodeId: null, selectedTagId: null };
  }, [raw, tagsBySlug]);

  const setSelection = useCallback(
    (selection: Selection) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!selection) {
        params.delete("node");
      } else if (selection.kind === "tag") {
        const slug = tagsById.get(selection.tagId);
        if (!slug) {
          // Tags aren't loaded yet — refuse to write rather than emit a
          // numeric id the reader can't resolve (it only resolves by slug).
          // useTagClusters gates cluster rendering on useTags resolving, so
          // a real cluster click can't reach this branch; defensive only.
          return;
        }
        params.set("node", `tag:${slug}`);
      } else {
        // selection.nodeId is already "kind:id".
        params.set("node", selection.nodeId);
      }
      // URLSearchParams percent-encodes `:` (→ `%3A`), making the param look
      // like `?node=tag%3Aventure`. The colon is reserved-but-allowed in
      // query values, so decode it back for a friendlier URL — but ONLY
      // within the `node` param's value, to avoid mutating unrelated params
      // that may legitimately carry encoded colons.
      const query = params
        .toString()
        .replace(/(^|&)(node=)([^&]*)/, (_, sep, key, value) =>
          `${sep}${key}${value.replace(/%3A/g, ":")}`,
        );
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams, tagsById],
  );

  const clearSelection = useCallback(() => setSelection(null), [setSelection]);

  return { selectedNodeId, selectedTagId, setSelection, clearSelection };
}
