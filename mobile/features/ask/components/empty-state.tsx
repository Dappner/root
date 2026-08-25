import { appTheme } from "@/features/ui";
import { Microphone } from "phosphor-react-native/src/icons/Microphone";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Prompt = { id: string; label: string };

const PROMPTS: Prompt[] = [
  { id: "themes", label: "What themes recur across my recent sources?" },
  { id: "summary", label: "Summarize my latest podcast takeaways" },
  { id: "compare", label: "Compare ideas across two sources I saved" },
];

export function AskEmptyState({
  onPromptPress,
  onStartVoice,
}: {
  onPromptPress: (text: string) => void;
  onStartVoice: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Sparkle size={28} color={appTheme.color.primary} weight="fill" />
      </View>
      <Text style={styles.title}>Ask Root</Text>
      <Text style={styles.subtitle}>
        Search across your saved sources, podcast transcripts, captures, citations, and takeaways.
      </Text>

      <View style={styles.suggestions}>
        {PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt.id}
            style={styles.suggestion}
            activeOpacity={0.7}
            onPress={() => onPromptPress(prompt.label)}
          >
            <Text style={styles.suggestionText}>{prompt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.voiceButton} activeOpacity={0.85} onPress={onStartVoice}>
        <Microphone size={18} color={appTheme.color.primaryForeground} weight="fill" />
        <Text style={styles.voiceButtonText}>Speak to Root</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appTheme.color.borderSoft,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: appTheme.color.foreground,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: appTheme.color.muted,
    maxWidth: 320,
  },
  suggestions: {
    width: "100%",
    gap: 8,
    marginTop: 16,
  },
  suggestion: {
    backgroundColor: appTheme.color.surface,
    borderWidth: 1,
    borderColor: appTheme.color.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionText: {
    color: appTheme.color.foreground,
    fontSize: 14,
    lineHeight: 19,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: appTheme.color.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginTop: 20,
  },
  voiceButtonText: {
    color: appTheme.color.primaryForeground,
    fontWeight: "700",
    fontSize: 15,
  },
});
