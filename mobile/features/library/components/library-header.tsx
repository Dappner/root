import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { colors } from "../theme";

export interface LibraryHeaderProps {
  showSearchButton: boolean;
  searchVisible: boolean;
  onToggleSearch: () => void;
}

export function LibraryHeader({ showSearchButton, searchVisible, onToggleSearch }: LibraryHeaderProps) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>All your sources, organized.</Text>
      </View>
      <View style={styles.headerActions}>
        {showSearchButton && (
          <TouchableOpacity
            style={[styles.iconBtn, searchVisible && styles.iconBtnActive]}
            onPress={onToggleSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MagnifyingGlass size={18} color={searchVisible ? "#fff" : colors.foreground} weight="regular" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => router.push("/(app)/(tabs)/(settings)")}
          activeOpacity={0.85}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  title: { fontSize: 32, fontWeight: "700", color: colors.foreground, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
