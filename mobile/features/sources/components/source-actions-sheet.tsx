import type { SourceDTO } from "../api";
import { useRegenerateSections } from "../mutations";
import { SourceDTOStatus as UpdateSourceRequestStatus } from "@/lib/api/rag-generated";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "phosphor-react-native/src/icons/Check";
import { CircleDashed } from "phosphor-react-native/src/icons/CircleDashed";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";

const colors = {
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  borderSoft: "#E4DBC5",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
  reflectAccent: "#7B5BB6",
  dot: {
    todo: "#C9A84C",
    done: "#8A8A8A",
  },
};

const STATUS_OPTION_META: Record<UpdateSourceRequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  [UpdateSourceRequestStatus.todo]:        { label: "To do",       color: colors.dot.todo,      icon: <CircleDashed size={18} color={colors.dot.todo} weight="regular" /> },
  [UpdateSourceRequestStatus.in_progress]: { label: "In progress", color: colors.primary,       icon: <CircleDashed size={18} color={colors.primary} weight="regular" /> },
  [UpdateSourceRequestStatus.reflecting]:  { label: "Reflecting",  color: colors.reflectAccent, icon: <Sparkle size={18} color={colors.reflectAccent} weight="regular" /> },
  [UpdateSourceRequestStatus.done]:        { label: "Done",        color: colors.dot.done,      icon: <CheckCircle size={18} color={colors.dot.done} weight="regular" /> },
};

export interface SourceActionsSheetProps {
  source: SourceDTO | null;
  onClose: () => void;
  onPlay: (source: SourceDTO) => void;
  onOpen: (source: SourceDTO) => void;
  onStatusChange: (id: number, status: UpdateSourceRequestStatus) => void;
}

export function SourceActionsSheet({
  source,
  onClose,
  onPlay,
  onOpen,
  onStatusChange,
}: SourceActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const canPlay = source?.type === "podcast" && !!source.episode_id;
  const isAv = !!(source?.episode_id || source?.video_id);
  const regenerate = useRegenerateSections();
  const isRegenerating = regenerate.isPending;

  return (
    <Modal
      visible={source != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 24) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          {source && (
            <>
              <View style={styles.headerRow}>
                {source.image_url ? (
                  <Image source={{ uri: source.image_url }} style={styles.headerThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.headerThumb, styles.headerThumbPlaceholder]}>
                    <Text style={styles.headerThumbText}>
                      {source.type?.slice(0, 1).toUpperCase() ?? "?"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle} numberOfLines={2}>{source.title}</Text>
                  {source.author && (
                    <Text style={styles.headerAuthor} numberOfLines={1}>{source.author}</Text>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Move to</Text>
              <View style={styles.statusGrid}>
                {(Object.values(UpdateSourceRequestStatus) as UpdateSourceRequestStatus[]).map((status) => {
                  const meta = STATUS_OPTION_META[status];
                  const isCurrent = source.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={styles.statusOption}
                      onPress={() => {
                        if (isCurrent) {
                          onClose();
                        } else {
                          onStatusChange(source.id, status);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      {meta.icon}
                      <Text style={[styles.statusOptionText, isCurrent && { color: meta.color, fontWeight: "600" }]}>
                        {meta.label}
                      </Text>
                      {isCurrent && (
                        <Check size={14} color={meta.color} weight="bold" style={{ marginLeft: "auto" }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => onOpen(source)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionText}>Open details</Text>
              </TouchableOpacity>
              {canPlay && (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => onPlay(source)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionText}>Play episode</Text>
                </TouchableOpacity>
              )}
              {isAv && (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => regenerate.mutate(source.id)}
                  activeOpacity={0.7}
                  disabled={isRegenerating}
                >
                  <View style={styles.actionInline}>
                    <Text
                      style={[
                        styles.actionText,
                        isRegenerating && { color: colors.muted },
                      ]}
                    >
                      {isRegenerating ? "Generating sections…" : "Regenerate sections"}
                    </Text>
                    {isRegenerating && (
                      <ActivityIndicator size="small" color={colors.muted} />
                    )}
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 4,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerThumb: { width: 48, height: 48, borderRadius: 8 },
  headerThumbPlaceholder: { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  headerThumbText: { fontSize: 16, fontWeight: "600", color: colors.muted },
  headerTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 19 },
  headerAuthor: { fontSize: 12, color: colors.muted, marginTop: 2 },

  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 8,
  },
  statusGrid: { gap: 2, marginBottom: 6 },
  statusOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statusOptionText: { fontSize: 15, color: colors.foreground, fontWeight: "500" },

  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionInline: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionText: { fontSize: 15, color: colors.foreground, fontWeight: "500" },

  cancelBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.borderSoft,
    borderRadius: 12,
  },
  cancelText: { fontSize: 15, color: colors.foreground, fontWeight: "600" },
});
