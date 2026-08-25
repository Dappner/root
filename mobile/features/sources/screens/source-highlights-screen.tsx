import {
  useSourceSections,
  useSourceCitations,
  useSourceCaptures,
} from "@/features/sources/hooks";
import {
  groupHighlights,
  SectionGroup,
} from "@/features/sources/components/highlights";
import { BackButton, EmptyState, AppScreen, LoadingState, PageHeader } from "@/features/ui";
import { useLocalSearchParams } from "expo-router";

export default function HighlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const { data: sections = [], isLoading: loadingSections } = useSourceSections(sourceId);
  const { data: citations = [], isLoading: loadingCitations } = useSourceCitations(sourceId);
  const { data: captures = [], isLoading: loadingCaptures } = useSourceCaptures(sourceId);

  const isLoading = loadingSections || loadingCitations || loadingCaptures;

  const { sectionGroups, unsorted } = groupHighlights(sections, citations, captures);

  const hasContent =
    sectionGroups.some((g) => g.citationsWithCaptures.length > 0 || g.standaloneCaptures.length > 0) ||
    unsorted.citationsWithCaptures.length > 0 ||
    unsorted.standaloneCaptures.length > 0;

  return (
    <AppScreen scroll>
      <BackButton />
      <PageHeader title="Highlights" />

      {isLoading && <LoadingState />}

      {!isLoading && !hasContent && (
        <EmptyState message="No highlights yet." />
      )}

      {!isLoading && hasContent && (
        <>
          {sectionGroups
            .filter((g) => g.citationsWithCaptures.length > 0 || g.standaloneCaptures.length > 0)
            .map((group) => (
              <SectionGroup key={group.section?.id ?? "unsorted"} group={group} />
            ))}
          {(unsorted.citationsWithCaptures.length > 0 || unsorted.standaloneCaptures.length > 0) && (
            <SectionGroup group={unsorted} />
          )}
        </>
      )}
    </AppScreen>
  );
}
