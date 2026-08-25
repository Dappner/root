import { AskEmptyState } from "@/features/ask/components/empty-state";
import { AskInput, StatusLine } from "@/features/ask/components/ask-input";
import { CitationSheet } from "@/features/ask/components/citation-sheet";
import { MessageBubble } from "@/features/ask/components/message-bubble";
import { useAskStream } from "@/features/ask/use-ask-stream";
import type { ChatMessage, RagCitation } from "@/features/ask/types";
import { useVoiceAgent } from "@/features/voice-agent/context";
import { appTheme } from "@/features/ui";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ActiveCitation = { token: string; citation: RagCitation };

export default function AskScreen() {
  const [input, setInput] = useState("");
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const voiceAgent = useVoiceAgent();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const { messages, isStreaming, isReconnecting, error, ask, stop } = useAskStream();

  const startVoice = useCallback(() => {
    void voiceAgent.start();
  }, [voiceAgent]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question) return;
    setInput("");
    await ask(question);
  }, [ask, input]);

  const handlePromptPress = useCallback(
    (text: string) => {
      setInput("");
      void ask(text);
    },
    [ask]
  );

  const handleCitationPress = useCallback(
    (message: ChatMessage, token: string) => {
      const citation = message.citations?.[token];
      if (citation) setActiveCitation({ token, citation });
    },
    []
  );

  const handleOpenSource = useCallback(
    (sourceId: number) => {
      setActiveCitation(null);
      router.push(`/sources/${sourceId}`);
    },
    [router]
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Ask</Text>
        <Text style={styles.subtitle}>Search across your Root library</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messages,
          messages.length === 0 && styles.emptyMessages,
        ]}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onCitationPress={(token) => handleCitationPress(item, token)}
          />
        )}
        onContentSizeChange={() => {
          if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
        }}
        ListEmptyComponent={
          <AskEmptyState
            onPromptPress={handlePromptPress}
            onStartVoice={startVoice}
          />
        }
      />

      {isReconnecting && <StatusLine text="Reconnecting…" />}
      {error && <Text style={styles.error}>{error}</Text>}

      <AskInput
        value={input}
        onChangeText={setInput}
        onSend={handleSend}
        onStop={stop}
        onMic={startVoice}
        isStreaming={isStreaming}
      />

      <CitationSheet
        token={activeCitation?.token ?? null}
        citation={activeCitation?.citation ?? null}
        onClose={() => setActiveCitation(null)}
        onOpenSource={handleOpenSource}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appTheme.color.background },
  header: { paddingHorizontal: 24, paddingBottom: 12 },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: appTheme.color.foreground,
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 14, color: appTheme.color.muted, marginTop: 2 },
  messages: { paddingHorizontal: 18, paddingBottom: 16, gap: 14 },
  emptyMessages: { flexGrow: 1, justifyContent: "center" },
  error: {
    color: appTheme.color.danger,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
});
