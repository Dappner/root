import { StyleSheet, Text, View } from "react-native";
import type { NoteListDTO } from "@/lib/api/rag-generated";
import { NoteCard } from "./note-card";
import { colors } from "./theme";

export function NotesTab({ notes }: { notes: NoteListDTO[] }) {
  return (
    <View style={styles.tabContent}>
      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No notes for this source yet.</Text>
        </View>
      ) : (
        notes.map((note) => <NoteCard key={note.id} note={note} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: colors.muted },
});
