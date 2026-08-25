import { useSources } from "@/features/sources/hooks";
import type { SourceDTO as GoSourceDTO } from "@/features/sources/api";
import { useHomeData } from "@/features/home/hooks";
import { useContinueListening } from "@/features/podcasts/hooks";
import { usePlaySource } from "@/features/player/use-play-source";
import type {
  HomePickupNote,
  HomeRecentlyCaptured,
} from "@/features/home/types";
import { TakeawayRow } from "@/features/takeaways/components/takeaway-row";
import {
  formatTimestamp,
  getSourcePlaybackPosition,
} from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { appTheme } from "@/features/ui";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { Play } from "phosphor-react-native/src/icons/Play";
import { DotsThree } from "phosphor-react-native/src/icons/DotsThree";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { BookmarkSimple } from "phosphor-react-native/src/icons/BookmarkSimple";
import { FileText } from "phosphor-react-native/src/icons/FileText";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMemo } from "react";

const colors = appTheme.color;

const NOTE_TINTS = ["#F4E4D2", "#DCEAD8", "#F1E9CF"];

const SCREEN_WIDTH = Dimensions.get("window").width;
const PICKUP_CARD_WIDTH = (SCREEN_WIDTH - 32 - 28 - 16) / 3;
const CAPTURED_CARD_WIDTH = Math.min(160, (SCREEN_WIDTH - 64) / 2.4);

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  if (diffMs < dayMs && now.getDate() === d.getDate()) return "Today";
  if (diffMs < 2 * dayMs) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const { data: sources, isLoading: isLoadingSources } = useSources();
  const { data: home, isLoading: isLoadingHome } = useHomeData();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const playSource = usePlaySource();

  const isLoading = isLoadingSources || isLoadingHome;
  const user = session?.user;
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const continueListening = useContinueListening(2);

  const recentTakeaways = useMemo(
    () =>
      (home?.recent_takeaways ?? []).filter(
        (takeaway) => takeaway?.id != null && takeaway.source?.id != null,
      ),
    [home?.recent_takeaways],
  );
  const pickupNotes = home?.pickup_notes ?? [];
  const recentlyCaptured = home?.recently_captured ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 120 }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.greetingLabel}>Good {getTimeOfDay()}, {firstName}</Text>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Here's what's going on with your thinking.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/(app)/(tabs)/(library)")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MagnifyingGlass size={20} color={colors.foreground} weight="regular" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push("/(app)/(tabs)/(settings)")}
            activeOpacity={0.85}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      )}

      {!isLoading && continueListening.length > 0 && (
        <SectionCard title="Continue where you left off" onSeeAll={() => router.push("/(app)/(tabs)/(library)")}>
          {continueListening.map((item, idx) => (
            <ContinueRow
              key={item.source.id}
              source={item.source}
              isLast={idx === continueListening.length - 1}
              onPress={() => router.push(`/sources/${item.source.id}`)}
              onPlay={() => playSource(item.source)}
            />
          ))}
        </SectionCard>
      )}

      {!isLoading && recentTakeaways.length > 0 && (
        <SectionCard
          title="Recent takeaways"
          leadingIcon={<Lightbulb size={15} color={colors.muted} weight="regular" />}
          onSeeAll={() => router.push("/(app)/(tabs)/(library)?tab=takeaways")}
        >
          <View style={styles.takeawayStack}>
            {recentTakeaways.map((t) => (
              <TakeawayRow
                key={t.id}
                takeaway={t}
                onPress={() => router.push(`/sources/${t.source.id}/takeaways`)}
              />
            ))}
          </View>
        </SectionCard>
      )}

      {!isLoading && pickupNotes.length > 0 && (
        <SectionCard
          title="Pick up where you left off"
          rightLabel={`${pickupNotes.length} item${pickupNotes.length === 1 ? "" : "s"}`}
        >
          <View style={styles.pickupRow}>
            {pickupNotes.map((note, idx) => (
              <PickupNoteCard
                key={note.id}
                note={note}
                tintIndex={idx}
                onPress={() => router.push("/(app)/(tabs)/(library)/notes")}
              />
            ))}
          </View>
        </SectionCard>
      )}

      {!isLoading && recentlyCaptured.length > 0 && (
        <SectionCard
          title="Recently captured"
          onSeeAll={() => router.push("/(app)/(tabs)/(library)")}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {recentlyCaptured.map((item) => (
              <CapturedCard
                key={item.source.id}
                item={item}
                onPress={() => router.push(`/sources/${item.source.id}`)}
              />
            ))}
          </ScrollView>
        </SectionCard>
      )}
    </ScrollView>
  );
}

function SectionCard({
  title,
  rightLabel,
  onSeeAll,
  leadingIcon,
  children,
}: {
  title: string;
  rightLabel?: string;
  onSeeAll?: () => void;
  leadingIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const showRight = onSeeAll || rightLabel;
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          {leadingIcon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {showRight && (
          <TouchableOpacity
            onPress={onSeeAll}
            disabled={!onSeeAll}
            style={styles.seeAllBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAllText}>{rightLabel ?? "See all"}</Text>
            {onSeeAll && <CaretRight size={12} color={colors.muted} weight="bold" />}
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function ContinueRow({
  source,
  isLast,
  onPress,
  onPlay,
}: {
  source: GoSourceDTO;
  isLast: boolean;
  onPress: () => void;
  onPlay: () => void;
}) {
  const { posSec, durSec, progress } = getSourcePlaybackPosition(source.metadata);
  const timeLabel = posSec > 0 && durSec > 0 ? `${formatTimestamp(posSec)} / ${formatTimestamp(durSec)}` : null;
  const rate = (source.metadata as { playback_rate?: number } | null)?.playback_rate;
  const rateLabel = rate && rate !== 1 ? `${rate}x` : null;

  return (
    <TouchableOpacity
      style={[styles.continueRow, !isLast && styles.continueRowBorder]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {source.image_url ? (
        <Image source={{ uri: source.image_url }} style={styles.continueThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.continueThumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>♪</Text>
        </View>
      )}
      <View style={styles.continueInfo}>
        <Text style={styles.continueTitle} numberOfLines={2}>{source.title}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(progress ?? 0) * 100}%` }]} />
        </View>
        <View style={styles.continueMetaRow}>
          {timeLabel && <Text style={styles.continueMeta}>{timeLabel}</Text>}
          {rateLabel && <Text style={styles.continueMeta}>• {rateLabel}</Text>}
        </View>
      </View>
      <View style={styles.continueActions}>
        <TouchableOpacity
          style={styles.playCircle}
          onPress={(e) => { e.stopPropagation(); onPlay(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Play size={16} color={colors.primary} weight="fill" />
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={(e) => { e.stopPropagation(); }}
        >
          <DotsThree size={20} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function PickupNoteCard({
  note,
  tintIndex,
  onPress,
}: {
  note: HomePickupNote;
  tintIndex: number;
  onPress: () => void;
}) {
  const tint = NOTE_TINTS[tintIndex % NOTE_TINTS.length];
  return (
    <TouchableOpacity style={styles.pickupCard} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.pickupIconTile, { backgroundColor: tint }]}>
        <FileText size={16} color={colors.foreground} weight="regular" />
      </View>
      <Text style={styles.pickupTitle} numberOfLines={2}>{note.title}</Text>
      <Text style={styles.pickupMeta} numberOfLines={1}>
        Edited {formatRelativeDate(note.updated_at)}
      </Text>
      <View style={styles.pickupBar}>
        <View style={[styles.pickupBarFill, { width: `${Math.min(100, (note.word_count ?? 0) / 5)}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

function CapturedCard({
  item,
  onPress,
}: {
  item: HomeRecentlyCaptured;
  onPress: () => void;
}) {
  const { source, captured_at } = item;
  const dateLabel = formatRelativeDate(captured_at);
  const typeLabel = source.type ? source.type.charAt(0).toUpperCase() + source.type.slice(1) : "";
  return (
    <TouchableOpacity style={styles.capturedCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.capturedHead}>
        {source.image_url ? (
          <Image source={{ uri: source.image_url }} style={styles.capturedThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.capturedThumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>{source.type?.slice(0, 1).toUpperCase() ?? "?"}</Text>
          </View>
        )}
      </View>
      <Text style={styles.capturedTitle} numberOfLines={2}>{source.title}</Text>
      <Text style={styles.capturedMeta} numberOfLines={1}>
        {dateLabel}{typeLabel ? ` · ${typeLabel}` : ""}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 16 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerLeft: { flex: 1 },
  greetingLabel: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  title: { fontSize: 36, fontWeight: "700", color: colors.foreground, letterSpacing: -0.6, lineHeight: 42 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 24 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  avatarButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "700", color: colors.primaryForeground },

  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, letterSpacing: -0.2 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 13, color: colors.muted, fontWeight: "500" },

  continueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  continueRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  continueThumb: { width: 56, height: 56, borderRadius: 8 },
  continueInfo: { flex: 1, gap: 4 },
  continueTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 18 },
  progressTrack: { height: 3, backgroundColor: colors.borderSoft, borderRadius: 2, marginTop: 2 },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  continueMetaRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  continueMeta: { fontSize: 11, color: colors.muted },
  continueActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  playCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center",
  },

  pickupRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  pickupCard: {
    width: PICKUP_CARD_WIDTH,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 6,
  },
  pickupIconTile: {
    width: 28, height: 28, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  pickupTitle: { fontSize: 12, fontWeight: "600", color: colors.foreground, lineHeight: 16 },
  pickupMeta: { fontSize: 10, color: colors.muted },
  pickupBar: { height: 3, borderRadius: 2, backgroundColor: colors.borderSoft, marginTop: 2 },
  pickupBarFill: { height: 3, borderRadius: 2, backgroundColor: colors.primary },

  carousel: { paddingHorizontal: 16, gap: 12 },
  capturedCard: {
    width: CAPTURED_CARD_WIDTH,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 6,
  },
  capturedHead: { flexDirection: "row" },
  capturedThumb: { width: 36, height: 36, borderRadius: 6 },
  capturedTitle: { fontSize: 12, fontWeight: "600", color: colors.foreground, lineHeight: 16 },
  capturedMeta: { fontSize: 10, color: colors.muted },

  thumbPlaceholder: { backgroundColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { fontSize: 14, fontWeight: "600", color: colors.muted },

  takeawayStack: { paddingHorizontal: 16, gap: 10 },
});
