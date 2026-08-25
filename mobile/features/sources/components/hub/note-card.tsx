import { StyleSheet, Text, View } from "react-native";
import type { NoteListDTO } from "@/lib/api/rag-generated";
import { formatRelativeDate } from "@/lib/utils";
import { colors } from "./theme";

export function NoteCard({ note }: { note: NoteListDTO }) {
  const kindLabel =
    note.kind === "source_note" ? "Source note" : note.kind === "reflection" ? "Reflection" : "Note";
  return (
    <View style={styles.highlightCard}>
      <View style={styles.highlightKindRow}>
        <View style={[styles.highlightKindBadge, styles.highlightKindBadgeCapture]}>
          <Text style={[styles.highlightKindText, styles.highlightKindTextCapture]}>{kindLabel}</Text>
        </View>
        <Text style={styles.highlightMeta}>{formatRelativeDate(note.updated_at)}</Text>
      </View>
      {note.title ? <Text style={styles.noteTitle}>{note.title}</Text> : null}
      {note.preview ? <Text style={styles.highlightSummary}>{note.preview}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  highlightCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 8,
  },
  highlightKindRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  highlightKindBadge: { backgroundColor: "#FEF3C7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  highlightKindBadgeCapture: { backgroundColor: colors.primaryLight },
  highlightKindText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  highlightKindTextCapture: { color: colors.primary },
  noteTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 20 },
  highlightSummary: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  highlightMeta: { fontSize: 11, color: colors.muted },
});
