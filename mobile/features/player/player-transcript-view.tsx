import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { TranscriptData, TranscriptUtterance } from "@/lib/api/rag-generated";
import { ArrowDown } from "phosphor-react-native/src/icons/ArrowDown";

const colors = {
  foreground: "#2C2C2C",
  fadedForeground: "#2C2C2C99",
  muted: "#666050",
  mutedSoft: "#A29C8B",
  pillBg: "#2C2C2CDD",
  pillText: "#FFFFFF",
  primary: "#3F6B51",
  primaryForeground: "#FFFFFF",
};

interface PlayerTranscriptViewProps {
  transcript: TranscriptData | null;
  transcriptLoading: boolean;
  transcriptProcessing: boolean;
  triggering: boolean;
  onTriggerGeneration: () => void;
  positionSec: number;
  onSeek: (seconds: number) => void;
}

function findActiveIndex(utterances: TranscriptUtterance[], positionSec: number): number {
  if (utterances.length === 0) return -1;
  let lo = 0;
  let hi = utterances.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const u = utterances[mid];
    if (positionSec < u.start) hi = mid - 1;
    else if (positionSec >= u.end) lo = mid + 1;
    else return mid;
  }
  // Between utterances — pick the most recent one that has started.
  return Math.max(0, Math.min(utterances.length - 1, hi));
}

export function PlayerTranscriptView({
  transcript,
  transcriptLoading,
  transcriptProcessing,
  triggering,
  onTriggerGeneration,
  positionSec,
  onSeek,
}: PlayerTranscriptViewProps) {
  const listRef = useRef<FlatList<TranscriptUtterance>>(null);
  const [userScrubbing, setUserScrubbing] = useState(false);
  const userScrubbingRef = useRef(false);

  const utterances = transcript?.utterances ?? [];
  const activeIndex = useMemo(
    () => findActiveIndex(utterances, positionSec),
    [utterances, positionSec]
  );

  const scrollToActive = useCallback(
    (animated: boolean) => {
      if (activeIndex < 0) return;
      listRef.current?.scrollToIndex({
        index: activeIndex,
        animated,
        viewPosition: 0.35,
      });
    },
    [activeIndex]
  );

  useEffect(() => {
    if (userScrubbingRef.current) return;
    scrollToActive(true);
  }, [activeIndex, scrollToActive]);

  const onScrollBeginDrag = useCallback(() => {
    userScrubbingRef.current = true;
    setUserScrubbing(true);
  }, []);

  const resumeAutoScroll = useCallback(() => {
    userScrubbingRef.current = false;
    setUserScrubbing(false);
    scrollToActive(true);
  }, [scrollToActive]);

  if (transcriptLoading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!transcript || utterances.length === 0) {
    return (
      <View style={styles.empty}>
        {transcriptProcessing ? (
          <>
            <Text style={styles.emptyText}>Transcript is being processed…</Text>
            <Text style={styles.emptyHint}>Check back in a few minutes.</Text>
          </>
        ) : (
          <>
            <Text style={styles.emptyText}>No transcript available.</Text>
            <TouchableOpacity
              onPress={onTriggerGeneration}
              disabled={triggering}
              style={styles.triggerBtn}
              activeOpacity={0.85}
            >
              {triggering ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
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
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={utterances}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollToIndexFailed={(info) => {
          // Items not yet measured — fall back to approximate offset then retry.
          const offset = info.averageItemLength * info.index;
          listRef.current?.scrollToOffset({ offset, animated: false });
          setTimeout(() => {
            if (!userScrubbingRef.current) scrollToActive(false);
          }, 50);
        }}
        renderItem={({ item, index }) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onSeek(item.start)}
              style={styles.row}
            >
              <Text
                style={[
                  styles.utterance,
                  isActive ? styles.utteranceActive : isPast ? styles.utterancePast : styles.utteranceFuture,
                ]}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      {userScrubbing && activeIndex >= 0 && (
        <TouchableOpacity style={styles.nowPlayingPill} onPress={resumeAutoScroll} activeOpacity={0.85}>
          <ArrowDown size={14} color={colors.pillText} weight="bold" />
          <Text style={styles.nowPlayingText}>Now Playing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  row: { paddingVertical: 8 },
  utterance: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  utteranceActive: { color: colors.foreground },
  utterancePast: { color: colors.mutedSoft },
  utteranceFuture: { color: colors.mutedSoft },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyText: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: colors.mutedSoft },
  triggerBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  triggerBtnText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 14,
  },
  nowPlayingPill: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.pillBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nowPlayingText: {
    color: colors.pillText,
    fontSize: 13,
    fontWeight: "700",
  },
});
