import type { NoteListDTO } from "@/lib/api/rag-generated";
import { formatRelativeDate } from "@/lib/utils";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const colors = {
  foreground: "#2C2C2C",
  muted: "#666050",
  secondary: "#E4DBC5",
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "source_note":
      return "Source note";
    case "standalone":
      return "Note";
    case "reflection":
      return "Reflection";
    default:
      return kind;
  }
}

export interface NoteRowProps {
  note: NoteListDTO;
  onPress: () => void;
}

export function NoteRow({ note, onPress }: NoteRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.headerRow}>
        <View style={styles.kindBadge}>
          <Text style={styles.kindText}>{kindLabel(note.kind)}</Text>
        </View>
        <Text style={styles.dateText}>{formatRelativeDate(note.updated_at)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {note.title || "Untitled"}
      </Text>
      {note.preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          {note.preview}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindBadge: {
    backgroundColor: colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  kindText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  dateText: { fontSize: 11, color: colors.muted },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    lineHeight: 20,
  },
  preview: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
});
