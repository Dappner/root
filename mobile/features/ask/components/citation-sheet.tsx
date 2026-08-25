import { appTheme } from "@/features/ui";
import { ArrowSquareOut } from "phosphor-react-native/src/icons/ArrowSquareOut";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { RagCitation } from "../types";
import { getCitationTypeLabel } from "../utils";

type CitationStyle = { bg: string; fg: string };

const TYPE_STYLES: Record<RagCitation["type"], CitationStyle> = {
  citation: { bg: "rgba(124,58,237,0.10)", fg: "#7C3AED" },
  capture: { bg: "rgba(37,99,235,0.10)", fg: "#2563EB" },
  takeaway: { bg: "rgba(217,119,6,0.10)", fg: "#D97706" },
  source_section_summary: { bg: "rgba(8,145,178,0.10)", fg: "#0891B2" },
  transcript_chunk: { bg: "rgba(225,29,72,0.10)", fg: "#E11D48" },
};

function styleFor(type: RagCitation["type"]): CitationStyle {
  return TYPE_STYLES[type] ?? TYPE_STYLES.citation;
}

function getTitle(c: RagCitation): string {
  return (
    c.source_title ??
    c.takeaway_title ??
    c.section_title ??
    `${getCitationTypeLabel(c.type)} ${c.entity_id}`
  );
}

function getBodyText(c: RagCitation): string | null {
  return (
    c.text ??
    c.citation_text ??
    c.takeaway_body ??
    c.section_summary ??
    c.section_subtitle ??
    null
  );
}

function getMetaText(c: RagCitation): string | null {
  const parts: string[] = [];
  if (c.source_author) parts.push(c.source_author);
  if (c.section_title && c.source_title) parts.push(c.section_title);
  if (c.citation_speaker) parts.push(c.citation_speaker);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function CitationSheet({
  token,
  citation,
  onClose,
  onOpenSource,
}: {
  token: string | null;
  citation: RagCitation | null;
  onClose: () => void;
  onOpenSource?: (sourceId: number) => void;
}) {
  const visible = token != null && citation != null;
  const style = citation ? styleFor(citation.type) : null;
  const body = citation ? getBodyText(citation) : null;
  const meta = citation ? getMetaText(citation) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {citation && style && (
            <>
              <View style={styles.kindRow}>
                <View style={[styles.kindBadge, { backgroundColor: style.bg }]}>
                  <Text style={[styles.kindText, { color: style.fg }]}>
                    [{token}] {getCitationTypeLabel(citation.type)}
                  </Text>
                </View>
              </View>

              <Text style={styles.title}>{getTitle(citation)}</Text>
              {meta && <Text style={styles.meta}>{meta}</Text>}

              {body && (
                <View style={styles.bodyWrap}>
                  <Text style={styles.body}>{body}</Text>
                </View>
              )}

              {citation.source_id && onOpenSource && (
                <TouchableOpacity
                  style={styles.action}
                  activeOpacity={0.85}
                  onPress={() => onOpenSource(citation.source_id!)}
                >
                  <Text style={styles.actionText}>Open source</Text>
                  <ArrowSquareOut size={16} color={appTheme.color.primaryForeground} weight="bold" />
                </TouchableOpacity>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: appTheme.color.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: appTheme.color.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  kindText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: appTheme.color.foreground,
    lineHeight: 23,
  },
  meta: { fontSize: 12, color: appTheme.color.muted },
  bodyWrap: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  body: {
    fontSize: 15,
    color: appTheme.color.foreground,
    lineHeight: 22,
  },
  action: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: appTheme.color.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionText: {
    color: appTheme.color.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
});
