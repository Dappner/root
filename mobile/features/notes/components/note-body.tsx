import { appTheme } from "@/features/ui";
import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

type Mark = { type: string; attrs?: Record<string, unknown> };

type Node = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  text?: string;
  marks?: Mark[];
};

function applyMarks(text: string, marks: Mark[] | undefined, key: string) {
  if (!marks || marks.length === 0) return <Fragment key={key}>{text}</Fragment>;
  const styles: object[] = [];
  for (const m of marks) {
    if (m.type === "bold") styles.push({ fontWeight: "700" });
    else if (m.type === "italic") styles.push({ fontStyle: "italic" });
    else if (m.type === "underline") styles.push({ textDecorationLine: "underline" });
    else if (m.type === "strike") styles.push({ textDecorationLine: "line-through" });
    else if (m.type === "code") styles.push(inlineStyles.code);
  }
  return (
    <Text key={key} style={styles}>
      {text}
    </Text>
  );
}

function renderInline(children: Node[] | undefined, keyPrefix: string) {
  if (!children) return null;
  return children.map((child, i) => {
    if (child.type === "text") {
      return applyMarks(child.text ?? "", child.marks, `${keyPrefix}-${i}`);
    }
    if (child.type === "hardBreak") return <Text key={`${keyPrefix}-${i}`}>{"\n"}</Text>;
    return null;
  });
}

function renderNode(node: Node, key: string): React.ReactNode {
  switch (node.type) {
    case "paragraph": {
      return (
        <Text key={key} style={inlineStyles.paragraph}>
          {renderInline(node.content, key)}
        </Text>
      );
    }
    case "heading": {
      const level = Math.max(1, Math.min(3, Number(node.attrs?.level ?? 1)));
      const style =
        level === 1
          ? inlineStyles.h1
          : level === 2
            ? inlineStyles.h2
            : inlineStyles.h3;
      return (
        <Text key={key} style={style}>
          {renderInline(node.content, key)}
        </Text>
      );
    }
    case "bulletList":
    case "orderedList": {
      const ordered = node.type === "orderedList";
      return (
        <View key={key} style={inlineStyles.list}>
          {(node.content ?? []).map((item, i) => (
            <View key={`${key}-${i}`} style={inlineStyles.listItem}>
              <Text style={inlineStyles.listMarker}>
                {ordered ? `${i + 1}.` : "•"}
              </Text>
              <View style={inlineStyles.listItemContent}>
                {(item.content ?? []).map((child, j) =>
                  renderNode(child, `${key}-${i}-${j}`)
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case "blockquote": {
      return (
        <View key={key} style={inlineStyles.blockquote}>
          {(node.content ?? []).map((child, i) =>
            renderNode(child, `${key}-${i}`)
          )}
        </View>
      );
    }
    case "codeBlock": {
      return (
        <View key={key} style={inlineStyles.codeBlock}>
          <Text style={inlineStyles.codeBlockText}>
            {renderInline(node.content, key)}
          </Text>
        </View>
      );
    }
    case "horizontalRule":
      return <View key={key} style={inlineStyles.hr} />;
    default:
      return null;
  }
}

export function NoteBody({ body }: { body: unknown }) {
  if (!body || typeof body !== "object") {
    return <Text style={inlineStyles.empty}>(empty note)</Text>;
  }
  const doc = body as Node;
  const content = doc.content ?? [];
  if (content.length === 0) {
    return <Text style={inlineStyles.empty}>(empty note)</Text>;
  }
  return <View>{content.map((node, i) => renderNode(node, `n-${i}`))}</View>;
}

const inlineStyles = StyleSheet.create({
  paragraph: {
    fontSize: 16,
    lineHeight: 25,
    color: appTheme.color.foreground,
    marginBottom: 14,
  },
  h1: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
    color: appTheme.color.foreground,
    marginTop: 18,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 26,
    color: appTheme.color.foreground,
    marginTop: 14,
    marginBottom: 8,
  },
  h3: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    color: appTheme.color.foreground,
    marginTop: 10,
    marginBottom: 6,
  },
  list: { marginBottom: 14, gap: 4 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listMarker: {
    color: appTheme.color.muted,
    fontSize: 16,
    lineHeight: 25,
    minWidth: 16,
    textAlign: "right",
  },
  listItemContent: { flex: 1 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: appTheme.color.primary,
    paddingLeft: 12,
    marginBottom: 14,
    opacity: 0.85,
  },
  codeBlock: {
    backgroundColor: appTheme.color.borderSoft,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  codeBlockText: {
    fontFamily: "monospace",
    fontSize: 13,
    color: appTheme.color.foreground,
    lineHeight: 19,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 14,
    backgroundColor: appTheme.color.borderSoft,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  hr: {
    height: 1,
    backgroundColor: appTheme.color.border,
    marginVertical: 16,
  },
  empty: {
    fontStyle: "italic",
    color: appTheme.color.muted,
    fontSize: 14,
  },
});
