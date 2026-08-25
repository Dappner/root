import { useOfflineStore, type SourceMeta } from "@/features/offline";
import { readLocalTranscript, usePlayer } from "@/features/player/context";
import { DownloadRow } from "@/features/settings/components/download-row";
import { useDownloadPreferences } from "@/features/settings/hooks";
import { colors, styles } from "@/features/settings/styles";
import {
  downloadQualityOptions,
  formatBytes,
  initialsFor,
  qualityLabels,
  STORAGE_LIMIT_BYTES,
} from "@/features/settings/utils";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "expo-router";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Database } from "phosphor-react-native/src/icons/Database";
import { DownloadSimple } from "phosphor-react-native/src/icons/DownloadSimple";
import { Gear } from "phosphor-react-native/src/icons/Gear";
import { Info } from "phosphor-react-native/src/icons/Info";
import { PlayCircle } from "phosphor-react-native/src/icons/PlayCircle";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { SignOut } from "phosphor-react-native/src/icons/SignOut";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const offline = useOfflineStore();
  const { play } = usePlayer();
  const {
    autoDownloadWifi,
    downloadQuality,
    setWifiPreference,
    setQualityPreference,
  } = useDownloadPreferences();

  const downloads = useMemo(() => offline.listDownloadedSources(), [offline, offline.version]);
  const storageBytes = useMemo(() => offline.getDownloadedStorageBytes(), [offline, offline.version]);
  const storageProgress = Math.min(1, storageBytes / STORAGE_LIMIT_BYTES);

  const deleteDownload = useCallback((sourceId: number) => {
    void offline.deleteSource(sourceId);
  }, [offline]);

  const playDownload = useCallback((meta: SourceMeta) => {
    if (!meta.source.episode_id) return;
    router.navigate("/player");
    void play({
      episode: meta.episode ?? {
        id: meta.source.episode_id,
        title: meta.source.title,
        image_url: meta.source.image_url,
        enclosure_url: meta.source.media_url ?? undefined,
        duration: meta.source.duration,
        episode_guid: "",
        transcript_status: "none",
        created_at: meta.source.created_at,
        updated_at: meta.source.updated_at,
      },
      source: meta.source,
      transcript: readLocalTranscript(meta.source.id),
    });
  }, [play, router]);

  const showDownloadMenu = useCallback((meta: SourceMeta) => {
    const view = () => router.push(`/sources/${meta.source.id}`);
    const playItem = () => { void playDownload(meta); };
    const remove = () => deleteDownload(meta.source.id);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "View source", "Play", "Remove download"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (idx) => {
          if (idx === 1) view();
          if (idx === 2) playItem();
          if (idx === 3) remove();
        }
      );
      return;
    }

    Alert.alert("Download", undefined, [
      { text: "View source", onPress: view },
      { text: "Play", onPress: playItem },
      { text: "Remove download", style: "destructive", onPress: remove },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [deleteDownload, playDownload, router]);

  const showQualityMenu = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", ...downloadQualityOptions.map((option) => qualityLabels[option])],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx > 0) setQualityPreference(downloadQualityOptions[idx - 1]);
        }
      );
      return;
    }

    Alert.alert("Download quality", undefined, [
      ...downloadQualityOptions.map((option) => ({
        text: qualityLabels[option],
        onPress: () => setQualityPreference(option),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, [setQualityPreference]);

  const user = session?.user;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Your account, downloads and preferences.</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.75}>
          <Gear size={18} color={colors.foreground} weight="bold" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(user?.name)}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{user?.name ?? "Account"}</Text>
          <Text style={styles.profileEmail} numberOfLines={1}>{user?.email ?? ""}</Text>
        </View>
        <CaretRight size={16} color={colors.muted} weight="bold" />
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.sectionTitleRow}>
            <DownloadSimple size={16} color={colors.muted} weight="regular" />
            <Text style={styles.sectionLabel}>Downloads</Text>
          </View>
          <View style={styles.headerMetaRow}>
            <Text style={styles.sectionMeta}>
              {downloads.length} source{downloads.length === 1 ? "" : "s"}
            </Text>
            <CaretRight size={14} color={colors.muted} weight="bold" />
          </View>
        </View>

        {downloads.length === 0 ? (
          <View style={styles.emptyDownloads}>
            <Text style={styles.emptyText}>No downloads yet.</Text>
          </View>
        ) : (
          <View style={styles.downloadList}>
            {downloads.map((meta, index) => (
              <DownloadRow
                key={meta.source.id}
                meta={meta}
                showDivider={index < downloads.length - 1}
                onMenu={() => showDownloadMenu(meta)}
                onDelete={() => deleteDownload(meta.source.id)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addDownloadsRow}
          activeOpacity={0.75}
          onPress={() => router.push("/(app)/(tabs)/(podcasts)")}
        >
          <Plus size={16} color={colors.primary} weight="regular" />
          <Text style={styles.addDownloadsText}>Add downloads</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <PlayCircle size={16} color={colors.muted} weight="regular" />
          <Text style={styles.sectionLabel}>Playback & Downloads</Text>
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>Auto-download on Wi-Fi</Text>
            <Text style={styles.preferenceSubtitle}>Download new episodes automatically</Text>
          </View>
          <Switch
            value={autoDownloadWifi}
            onValueChange={setWifiPreference}
            trackColor={{ false: colors.secondary, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.preferenceRow} activeOpacity={0.75} onPress={showQualityMenu}>
          <View style={styles.preferenceText}>
            <Text style={styles.preferenceTitle}>Download quality</Text>
            <Text style={styles.preferenceSubtitle}>{qualityLabels[downloadQuality]}</Text>
          </View>
          <CaretRight size={16} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionTitleRow}>
          <Database size={16} color={colors.muted} weight="regular" />
          <Text style={styles.sectionLabel}>Storage</Text>
        </View>
        <View style={styles.storageRow}>
          <View style={styles.storageTrack}>
            <View style={[styles.storageFill, { width: `${storageProgress * 100}%` }]} />
          </View>
          <Text style={styles.storageText}>{formatBytes(storageBytes)} of 10 GB used</Text>
          <CaretRight size={16} color={colors.muted} weight="bold" />
        </View>
      </View>

      <TouchableOpacity
        style={styles.simpleCard}
        activeOpacity={0.75}
        onPress={() => Alert.alert("About Root", "Root mobile")}
      >
        <View style={styles.sectionTitleRow}>
          <Info size={16} color={colors.muted} weight="regular" />
          <Text style={styles.simpleText}>About Root</Text>
        </View>
        <CaretRight size={16} color={colors.muted} weight="bold" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} activeOpacity={0.75} onPress={() => authClient.signOut()}>
        <SignOut size={18} color={colors.danger} weight="regular" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
