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
import { View } from "react-native";

export default function SectionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const { data: sections = [], isLoading: loadingSections } = useSourceSections(sourceId);
  const { data: citations = [], isLoading: loadingCitations } = useSourceCitations(sourceId);
  const { data: captures = [], isLoading: loadingCaptures } = useSourceCaptures(sourceId);

  const isLoading = loadingSections || loadingCitations || loadingCaptures;

  const { sectionGroups } = groupHighlights(sections, citations, captures);

  const sectionsWithContent = sectionGroups.filter(
    (g) => g.citationsWithCaptures.length > 0 || g.standaloneCaptures.length > 0
  );

  return (
    <AppScreen scroll>
      <BackButton />
      <PageHeader title="Sections" />

      {isLoading && <LoadingState />}

      {!isLoading && sectionsWithContent.length === 0 && (
        <EmptyState message="No sections with highlights yet." />
      )}

      {!isLoading && sectionsWithContent.length > 0 && (
        <View>
          {sectionsWithContent.map((group) => (
            <SectionGroup key={group.section?.id} group={group} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}
