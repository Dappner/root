import { NoteBody } from "@/features/notes/components/note-body";
import { useNote } from "@/features/notes/hooks";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "phosphor-react-native/src/icons/ArrowLeft";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const colors = {
  background: "#FAF5EB",
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
};

function kindLabel(kind: string): string {
  switch (kind) {
    case "source_note": return "Source note";
    case "standalone": return "Note";
    case "reflection": return "Reflection";
    default: return kind;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = id ? parseInt(id, 10) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: note, isLoading, error } = useNote(noteId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={colors.foreground} weight="regular" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {note?.title || "Note"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{(error as Error).message}</Text>}

      {note && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.meta}>
            <View style={styles.kindBadge}>
              <Text style={styles.kindText}>{kindLabel(note.kind)}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(note.updated_at)}</Text>
          </View>

          <Text style={styles.noteTitle}>{note.title}</Text>

          <View style={styles.divider} />

          <NoteBody body={note.body} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
    marginHorizontal: 8,
  },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 60 },

  meta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  kindBadge: {
    backgroundColor: colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  dateText: { fontSize: 12, color: colors.muted },

  noteTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 16,
  },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 20 },

  error: { color: "red", margin: 24 },
});
