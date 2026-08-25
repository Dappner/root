import { appTheme } from "@/features/ui";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { Microphone } from "phosphor-react-native/src/icons/Microphone";
import { Square } from "phosphor-react-native/src/icons/Square";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type AskInputProps = {
  value: string;
  onChangeText: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  onMic: () => void;
  isStreaming: boolean;
};

export function AskInput({
  value,
  onChangeText,
  onSend,
  onStop,
  onMic,
  isStreaming,
}: AskInputProps) {
  const hasText = value.trim().length > 0;

  return (
    <View style={styles.bar}>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask anything…"
          placeholderTextColor={appTheme.color.muted}
          multiline
          style={styles.input}
          editable={!isStreaming}
          returnKeyType="default"
        />
      </View>

      {isStreaming ? (
        <TouchableOpacity
          style={[styles.action, styles.stop]}
          onPress={onStop}
          activeOpacity={0.8}
          accessibilityLabel="Stop generating"
        >
          <Square size={16} color={appTheme.color.primaryForeground} weight="fill" />
        </TouchableOpacity>
      ) : hasText ? (
        <TouchableOpacity
          style={[styles.action, styles.send]}
          onPress={onSend}
          activeOpacity={0.8}
          accessibilityLabel="Send"
        >
          <ArrowUp size={20} color={appTheme.color.primaryForeground} weight="bold" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.action, styles.mic]}
          onPress={onMic}
          activeOpacity={0.8}
          accessibilityLabel="Voice"
        >
          <Microphone size={20} color={appTheme.color.primaryForeground} weight="fill" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function StatusLine({ text }: { text: string }) {
  return <Text style={styles.statusLine}>{text}</Text>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: appTheme.color.border,
    backgroundColor: appTheme.color.background,
  },
  inputWrap: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: appTheme.color.border,
    borderRadius: 22,
    backgroundColor: appTheme.color.surface,
    paddingHorizontal: 14,
    paddingVertical: 4,
    justifyContent: "center",
  },
  input: {
    color: appTheme.color.foreground,
    fontSize: 15,
    paddingVertical: 8,
    lineHeight: 20,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  send: { backgroundColor: appTheme.color.primary },
  stop: { backgroundColor: appTheme.color.foreground },
  mic: { backgroundColor: appTheme.color.primary },
  statusLine: {
    color: appTheme.color.muted,
    fontSize: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
    fontStyle: "italic",
  },
});
