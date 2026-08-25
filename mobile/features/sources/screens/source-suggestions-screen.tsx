import {
  useApproveSuggestion,
  useDismissSuggestion,
  useRetrySuggestion,
  useSourceSuggestions,
} from "@/features/suggestions/hooks";
import type { SuggestionResponse } from "@/features/suggestions/api";
import { appTheme } from "@/features/ui";
import type {
  ApproveSuggestionRequest,
  SuggestedCapturePayload,
  SuggestedCitationPayloadOutput,
  SuggestedPayloadEntitiesOutput,
} from "@/lib/api/rag-generated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const colors = appTheme.color;

export default function SourceSuggestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sourceId = id && Number.isFinite(Number(id)) ? Number(id) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: suggestions = [], isLoading } = useSourceSuggestions(sourceId);
  const approve = useApproveSuggestion(sourceId ?? 0);
  const dismiss = useDismissSuggestion(sourceId ?? 0);
  const retry = useRetrySuggestion(sourceId ?? 0);

  const visibleSuggestions = suggestions.filter((suggestion) =>
    ["ready", "processing", "failed"].includes(suggestion.status)
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Review suggestions</Text>
        <Text style={styles.subtitle}>Voice notes become citations or captures after approval.</Text>
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 28 }} />}

      {!isLoading && visibleSuggestions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nothing to review</Text>
          <Text style={styles.emptyText}>New voice notes will appear here after processing.</Text>
        </View>
      )}

      <View style={styles.list}>
        {visibleSuggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApprove={(payload) => approve.mutate({ id: suggestion.id, payload })}
            onDismiss={() => dismiss.mutate(suggestion.id)}
            onRetry={() => retry.mutate(suggestion.id)}
            isMutating={approve.isPending || dismiss.isPending || retry.isPending}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function getEntities(
  suggestion: SuggestionResponse,
): SuggestedPayloadEntitiesOutput | null {
  const p = suggestion.suggested_payload;
  if (!p || typeof p !== "object" || !("action" in p)) return null;
  if (p.action !== "create_entities") return null;
  return p as SuggestedPayloadEntitiesOutput;
}

function buildApprovePayload(
  entities: SuggestedPayloadEntitiesOutput,
  citationSelected: boolean[],
  captureSelected: boolean[],
): ApproveSuggestionRequest["payload"] {
  const sourceCitations = entities.citations ?? [];
  const sourceCaptures = entities.captures ?? [];
  const keptMap = new Map<number, number>();
  const citations: SuggestedCitationPayloadOutput[] = [];
  sourceCitations.forEach((c, oldIdx) => {
    if (!citationSelected[oldIdx]) return;
    keptMap.set(oldIdx, citations.length);
    citations.push(c);
  });
  const captures: SuggestedCapturePayload[] = [];
  sourceCaptures.forEach((c, oldIdx) => {
    if (!captureSelected[oldIdx]) return;
    const remapped =
      c.citation_idx != null ? keptMap.get(c.citation_idx) : undefined;
    captures.push({ ...c, citation_idx: remapped });
  });
  return {
    ...entities,
    citations,
    captures,
  } as ApproveSuggestionRequest["payload"];
}

function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
  onRetry,
  isMutating,
}: {
  suggestion: SuggestionResponse;
  onApprove: (payload: ApproveSuggestionRequest["payload"]) => void;
  onDismiss: () => void;
  onRetry: () => void;
  isMutating: boolean;
}) {
  const entities = getEntities(suggestion);
  const citations = entities?.citations ?? [];
  const captures = entities?.captures ?? [];
  const showSelection = citations.length + captures.length > 1;

  const [citationSelected, setCitationSelected] = useState<boolean[]>(() =>
    citations.map(() => true),
  );
  const [captureSelected, setCaptureSelected] = useState<boolean[]>(() =>
    captures.map(() => true),
  );

  const anySelected = useMemo(
    () =>
      citationSelected.some(Boolean) || captureSelected.some(Boolean),
    [citationSelected, captureSelected],
  );

  const handleApprove = () => {
    if (!entities) {
      onApprove(undefined);
      return;
    }
    onApprove(buildApprovePayload(entities, citationSelected, captureSelected));
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.status}>{suggestion.status}</Text>
        <Text style={styles.action}>{suggestion.suggested_action ?? "voice note"}</Text>
      </View>

      {suggestion.status === "processing" && (
        <Text style={styles.bodyText}>Processing transcript match...</Text>
      )}

      {suggestion.status === "failed" && (
        <Text style={styles.errorText}>{suggestion.error ?? "Processing failed."}</Text>
      )}

      {citations.map((c, i) => {
        const selected = citationSelected[i] ?? true;
        const label = citations.length > 1 ? `Citation ${i + 1}` : "Citation";
        return (
          <View
            key={`c-${i}`}
            style={[styles.payloadBlock, !selected && styles.excluded]}
          >
            <View style={styles.payloadRow}>
              <Text style={styles.payloadLabel}>{label}</Text>
              {showSelection && (
                <Switch
                  value={selected}
                  onValueChange={(next) =>
                    setCitationSelected((prev) =>
                      prev.map((s, idx) => (idx === i ? next : s)),
                    )
                  }
                  disabled={isMutating}
                />
              )}
            </View>
            <Text style={[styles.bodyText, !selected && styles.strikethrough]}>
              {c.text}
            </Text>
          </View>
        );
      })}

      {captures.map((c, i) => {
        const selected = captureSelected[i] ?? true;
        const baseLabel = captures.length > 1 ? `Capture ${i + 1}` : "Capture";
        const tie =
          c.citation_idx != null && citations.length > 1
            ? ` · on citation ${c.citation_idx + 1}`
            : "";
        return (
          <View
            key={`cap-${i}`}
            style={[styles.payloadBlock, !selected && styles.excluded]}
          >
            <View style={styles.payloadRow}>
              <Text style={styles.payloadLabel}>{`${baseLabel}${tie}`}</Text>
              {showSelection && (
                <Switch
                  value={selected}
                  onValueChange={(next) =>
                    setCaptureSelected((prev) =>
                      prev.map((s, idx) => (idx === i ? next : s)),
                    )
                  }
                  disabled={isMutating}
                />
              )}
            </View>
            <Text style={[styles.bodyText, !selected && styles.strikethrough]}>
              {c.text}
            </Text>
          </View>
        );
      })}

      {suggestion.voice_transcript && (
        <View style={styles.payloadBlock}>
          <Text style={styles.payloadLabel}>Voice note</Text>
          <Text style={styles.voiceText}>{suggestion.voice_transcript}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={onDismiss}
          disabled={isMutating}
        >
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
        {suggestion.status === "ready" && (
          <TouchableOpacity
            style={[styles.retryIconButton]}
            onPress={onRetry}
            disabled={isMutating}
            accessibilityRole="button"
            accessibilityLabel="Retry suggestion"
            accessibilityHint="Regenerates this suggestion"
          >
            <Text style={styles.retryIconText}>↻</Text>
          </TouchableOpacity>
        )}
        {suggestion.status === "failed" ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={onRetry}
            disabled={isMutating}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.approveButton,
              (suggestion.status !== "ready" || !anySelected) && styles.disabledButton,
            ]}
            onPress={handleApprove}
            disabled={isMutating || suggestion.status !== "ready" || !anySelected}
          >
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 120 },
  backButton: { marginBottom: 16 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  header: { gap: 6, marginBottom: 22 },
  title: { fontSize: 26, fontWeight: "800", color: colors.foreground },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted },
  list: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  status: { color: colors.primary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  action: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  payloadBlock: { gap: 5 },
  payloadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  payloadLabel: { color: colors.primary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  bodyText: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
  voiceText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  excluded: { opacity: 0.55 },
  strikethrough: { textDecorationLine: "line-through" },
  actions: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  dismissButton: { backgroundColor: colors.borderSoft },
  retryButton: { backgroundColor: "#7C3D12" },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  retryIconButton: {
    width: 44,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.borderSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryIconText: { color: colors.foreground, fontWeight: "800", fontSize: 16 },
  approveButton: { backgroundColor: colors.primary },
  disabledButton: { opacity: 0.45 },
  dismissText: { color: colors.foreground, fontWeight: "700" },
  approveText: { color: "#FFFFFF", fontWeight: "800" },
  emptyState: { paddingVertical: 42, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
