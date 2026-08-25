import { useMemo, useState } from "react";
import type { SourceDTO } from "@/features/sources/api";
import { SourceDTOStatus } from "@/lib/api/rag-generated";
import { useOfflineStore } from "@/features/offline";
import type { StatusFilter } from "../theme";

export interface UseLibraryFiltersArgs {
  sources: SourceDTO[] | undefined;
}

export function useLibraryFilters({ sources }: UseLibraryFiltersArgs) {
  const offline = useOfflineStore();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [excludeDone, setExcludeDone] = useState(false);
  const [excludeInCollections, setExcludeInCollections] = useState(false);
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const downloadedIds = useMemo(
    () => new Set(offline.listDownloadedSources().map((m) => m.source.id)),
    [offline, offline.version]
  );

  const baseFiltered = useMemo(() => {
    let list = sources ?? [];

    if (excludeDone) {
      list = list.filter((s) => s.status !== SourceDTOStatus.done);
    }
    if (excludeInCollections) {
      list = list.filter((s) => !s.collection_ids || s.collection_ids.length === 0);
    }
    if (downloadedOnly) {
      list = list.filter((s) => downloadedIds.has(s.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.author?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [sources, excludeDone, excludeInCollections, downloadedOnly, downloadedIds, searchQuery]);

  const flatFiltered = useMemo(() => {
    if (statusFilter === "all") return baseFiltered;
    return baseFiltered.filter((s) => s.status === statusFilter);
  }, [baseFiltered, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      [SourceDTOStatus.todo]: 0,
      [SourceDTOStatus.in_progress]: 0,
      [SourceDTOStatus.reflecting]: 0,
      [SourceDTOStatus.done]: 0,
    };
    for (const s of sources ?? []) {
      if (s.status && counts[s.status] !== undefined) counts[s.status]++;
    }
    return Object.assign(counts, { total: (sources ?? []).length });
  }, [sources]);

  const sectionedSources = useMemo(() => {
    const map: Record<string, SourceDTO[]> = {
      [SourceDTOStatus.in_progress]: [],
      [SourceDTOStatus.reflecting]: [],
      [SourceDTOStatus.todo]: [],
      [SourceDTOStatus.done]: [],
    };
    for (const s of baseFiltered) {
      if (s.status && map[s.status]) map[s.status].push(s);
    }
    return map;
  }, [baseFiltered]);

  const hasActiveFilters =
    excludeDone || excludeInCollections || downloadedOnly || statusFilter !== "all";
  const searchActive = !!searchQuery.trim();
  const showFlatList = statusFilter !== "all" || searchActive;

  return {
    // state
    searchVisible,
    setSearchVisible,
    searchQuery,
    setSearchQuery,
    excludeDone,
    setExcludeDone,
    excludeInCollections,
    setExcludeInCollections,
    downloadedOnly,
    setDownloadedOnly,
    statusFilter,
    setStatusFilter,
    // derived
    downloadedIds,
    baseFiltered,
    flatFiltered,
    statusCounts,
    sectionedSources,
    hasActiveFilters,
    searchActive,
    showFlatList,
  };
}
