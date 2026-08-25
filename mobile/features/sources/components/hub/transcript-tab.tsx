import { useRef } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TranscriptData } from "@/lib/api/rag-generated";
import { UtteranceRow } from "../transcript";
import type { CitationWithCapture } from "../../hooks";
import { colors } from "./theme";

export interface TranscriptTabProps {
  transcript: TranscriptData | null;
  transcriptLoading: boolean;
  transcriptProcessing: boolean;
  citationsByUtteranceIdx: Map<number, CitationWithCapture[]>;
  triggering: boolean;
  onTriggerGeneration: () => void;
  onHighlightPress: (cwc: CitationWithCapture) => void;
}

export function TranscriptTab({
  transcript,
  transcriptLoading,
  transcriptProcessing,
  citationsByUtteranceIdx,
  triggering,
  onTriggerGeneration,
  onHighlightPress,
}: TranscriptTabProps) {
  const listRef = useRef<FlatList>(null);

  if (transcriptLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  }

  if (!transcript) {
    return (
      <View style={styles.emptyState}>
        {transcriptProcessing ? (
          <>
            <Text style={styles.emptyText}>Transcript is being processed…</Text>
            <Text style={[styles.emptyText, { marginTop: 6, fontSize: 12 }]}>
              Check back in a few minutes.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyText}>No transcript available.</Text>
            <TouchableOpacity
              style={styles.triggerBtn}
              onPress={onTriggerGeneration}
              disabled={triggering}
              activeOpacity={0.8}
            >
              {triggering ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.triggerBtnText}>Generate transcript</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={transcript.utterances}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.transcriptList}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => {
          const uttCitations = citationsByUtteranceIdx.get(index) ?? [];
          return (
            <UtteranceRow
              utterance={item}
              citations={uttCitations}
              onHighlightPress={onHighlightPress}
            />
          );
        }}
      />
      <TouchableOpacity
        style={styles.transcriptScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      >
        <Text style={styles.transcriptScrollTopText}>↑ Top</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: colors.muted },
  triggerBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  triggerBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  transcriptList: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 80 },
  transcriptScrollTop: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  transcriptScrollTopText: { fontSize: 12, fontWeight: "700", color: colors.foreground },
});
