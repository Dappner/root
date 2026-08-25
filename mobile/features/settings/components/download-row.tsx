import type { SourceMeta } from "@/features/offline";
import { colors, styles } from "@/features/settings/styles";
import { formatDate, formatDuration } from "@/features/settings/utils";
import { DotsThree } from "phosphor-react-native/src/icons/DotsThree";
import { Trash } from "phosphor-react-native/src/icons/Trash";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface DownloadRowProps {
  meta: SourceMeta;
  showDivider: boolean;
  onMenu: () => void;
  onDelete: () => void;
}

export function DownloadRow({ meta, showDivider, onMenu, onDelete }: DownloadRowProps) {
  const duration = formatDuration(meta.source.duration);

  return (
    <View style={[styles.downloadRow, showDivider && styles.downloadRowDivider]}>
      {meta.source.image_url ? (
        <Image source={{ uri: meta.source.image_url }} style={styles.downloadThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.downloadThumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbText}>{meta.source.title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.downloadInfo}>
        <Text style={styles.downloadTitle} numberOfLines={2}>{meta.source.title}</Text>
        {duration ? <Text style={styles.downloadMeta}>{duration}</Text> : null}
        <Text style={styles.downloadMeta}>Downloaded {formatDate(meta.downloaded_at)}</Text>
      </View>

      <View style={styles.downloadActions}>
        <TouchableOpacity style={styles.rowIconButton} activeOpacity={0.75} onPress={onMenu}>
          <DotsThree size={18} color={colors.muted} weight="bold" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} activeOpacity={0.75} onPress={onDelete}>
          <Trash size={16} color={colors.danger} weight="regular" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
