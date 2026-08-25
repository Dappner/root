import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMemo } from "react";
import { useOfflineStore } from "./store";

const colors = {
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  primary: "#3F6B51",
  danger: "#9D2B2B",
  warning: "#C9A84C",
};

interface Props {
  sourceId: number;
}

export function PendingVoiceNotesCallout({ sourceId }: Props) {
  const offline = useOfflineStore();
  const notes = useMemo(
    () => offline.listPendingForSource(sourceId),
    [offline, offline.version, sourceId]
  );

  if (notes.length === 0) return null;

  const pending = notes.filter((n) => n.status === "pending");
  const failed = notes.filter((n) => n.status === "failed");

  const handleSyncPress = () => {
    void offline.processOutbox();
  };

  const handleFailedPress = () => {
    if (failed.length === 0) return;
    Alert.alert(
      "Voice notes failed to upload",
      `${failed.length} voice note${failed.length === 1 ? "" : "s"} could not be uploaded. Retry or discard?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard all",
          style: "destructive",
          onPress: () => {
            for (const n of failed) offline.discardPendingNote(n.source_id, n.client_id);
          },
        },
        {
          text: "Retry all",
          onPress: () => {
            for (const n of failed) offline.retryPendingNote(n.source_id, n.client_id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrapper}>
      {pending.length > 0 && (
        <TouchableOpacity style={styles.row} onPress={handleSyncPress} activeOpacity={0.75}>
          <View style={[styles.dot, { backgroundColor: colors.warning }]} />
          <Text style={styles.text}>
            {pending.length} voice note{pending.length === 1 ? "" : "s"} waiting to sync
          </Text>
          <Text style={styles.action}>Sync now</Text>
        </TouchableOpacity>
      )}
      {failed.length > 0 && (
        <TouchableOpacity style={styles.row} onPress={handleFailedPress} activeOpacity={0.75}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <Text style={styles.text}>
            {failed.length} voice note{failed.length === 1 ? "" : "s"} failed to upload
          </Text>
          <Text style={[styles.action, { color: colors.danger }]}>Review</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, fontSize: 13, color: colors.foreground, fontWeight: "500" },
  action: { fontSize: 13, color: colors.primary, fontWeight: "600" },
});
