import { useSourceTakeaways } from "@/features/sources/hooks";
import { TakeawayCard } from "@/features/sources/components/highlights";
import { BackButton, EmptyState, AppScreen, LoadingState, PageHeader } from "@/features/ui";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function TakeawaysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const { data: takeaways = [], isLoading } = useSourceTakeaways(sourceId);

  return (
    <AppScreen scroll>
      <BackButton />
      <PageHeader title="Takeaways" />

      {isLoading && <LoadingState />}

      {!isLoading && takeaways.length === 0 && (
        <EmptyState message="No takeaways yet." />
      )}

      {!isLoading && takeaways.length > 0 && (
        <View style={styles.list}>
          {takeaways.map((t) => (
            <TakeawayCard key={t.id} takeaway={t} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
