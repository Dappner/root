import { appTheme } from "@/features/ui";
import { Fragment } from "react";
import Markdown from "react-native-markdown-display";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { ChatMessage, CitationReference } from "../types";
import { parseAnswerCitations } from "../utils";
import { InlineCitationChip } from "./citation";

function parseCitationTags(text: string): Array<{ type: "text" | "citation"; content: string }> {
  const parts: Array<{ type: "text" | "citation"; content: string }> = [];
  const regex = /<([\d,\s]+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    for (const token of match[1].split(",").map((t) => t.trim())) {
      if (token) parts.push({ type: "citation", content: token });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts;
}

function AnswerText({
  text,
  citations,
  onCitationPress,
}: {
  text: string;
  citations: CitationReference[];
  onCitationPress?: (token: string) => void;
}) {
  const renderRules = {
    text: (
      node: { key: string; content?: string },
      _children: unknown,
      _parent: unknown,
      styles: Record<string, unknown>
    ) => {
      const content = node.content ?? "";
      const parts = parseCitationTags(content);

      if (parts.every((p) => p.type === "text")) {
        return (
          <Text key={node.key} style={styles.text as object}>
            {content}
          </Text>
        );
      }

      return (
        <Text key={node.key} style={styles.text as object}>
          {parts.map((part, idx) =>
            part.type === "citation" ? (
              <InlineCitationChip
                key={`${part.content}-${idx}`}
                token={part.content}
                citations={citations}
                onPress={onCitationPress}
              />
            ) : (
              <Fragment key={idx}>{part.content}</Fragment>
            )
          )}
        </Text>
      );
    },
  };

  return (
    <Markdown style={markdownStyles} rules={renderRules}>
      {text}
    </Markdown>
  );
}

export function MessageBubble({
  message,
  onCitationPress,
}: {
  message: ChatMessage;
  onCitationPress?: (token: string) => void;
}) {
  const isUser = message.role === "user";
  const citations = parseAnswerCitations({ answer: message.text, citations: message.citations });

  return (
    <View style={[styles.wrap, isUser ? styles.userWrap : styles.assistantWrap]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {message.text ? (
          isUser ? (
            <Text style={[styles.text, styles.userText]}>{message.text}</Text>
          ) : (
            <AnswerText
              text={message.text}
              citations={citations}
              onCitationPress={onCitationPress}
            />
          )
        ) : (
          <View style={styles.thinkingRow}>
            <ActivityIndicator color={appTheme.color.primary} size="small" />
            <Text style={styles.thinkingText}>Thinking…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: { color: appTheme.color.foreground, fontSize: 15, lineHeight: 22 },
  paragraph: { marginBottom: 10, marginTop: 0 },
  strong: { fontWeight: "700" as const, color: appTheme.color.foreground },
  em: { fontStyle: "italic" as const, color: appTheme.color.muted },
  code_inline: {
    fontFamily: "monospace",
    fontSize: 13,
    backgroundColor: appTheme.color.borderSoft,
    borderRadius: 4,
    paddingHorizontal: 4,
    color: appTheme.color.foreground,
  },
  bullet_list: { marginVertical: 6 },
  ordered_list: { marginVertical: 6 },
  list_item: { marginBottom: 4 },
  heading1: { fontSize: 20, fontWeight: "700" as const, color: appTheme.color.foreground, marginBottom: 6, marginTop: 12 },
  heading2: { fontSize: 17, fontWeight: "700" as const, color: appTheme.color.foreground, marginBottom: 4, marginTop: 10 },
  heading3: { fontSize: 15, fontWeight: "600" as const, color: appTheme.color.foreground, marginBottom: 2, marginTop: 8 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: appTheme.color.primary,
    paddingLeft: 10,
    marginVertical: 6,
    opacity: 0.75,
  },
  text: { color: appTheme.color.foreground },
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  userWrap: { alignItems: "flex-end" },
  assistantWrap: { alignItems: "stretch" },
  bubble: {
    maxWidth: "92%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: appTheme.color.primary,
  },
  assistantBubble: {
    backgroundColor: appTheme.color.surface,
    borderWidth: 1,
    borderColor: appTheme.color.border,
    alignSelf: "flex-start",
  },
  text: { fontSize: 15, lineHeight: 22, color: appTheme.color.foreground },
  userText: { color: appTheme.color.primaryForeground },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  thinkingText: { fontSize: 14, color: appTheme.color.muted },
});
