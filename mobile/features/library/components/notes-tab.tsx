import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { NoteListDTO } from "@/lib/api/rag-generated";
import { NoteRow } from "@/features/notes/components/note-row";
import { colors } from "../theme";

export interface NotesTabProps {
  loading: boolean;
  notes: NoteListDTO[];
}

export function NotesTab({ loading, notes }: NotesTabProps) {
  const router = useRouter();
  return (
    <>
      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {notes.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No notes yet.</Text>
        </View>
      )}
      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <NoteRow
            note={item}
            onPress={() => router.push(`/(app)/(tabs)/(library)/notes/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  rowSeparator: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: 16 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
