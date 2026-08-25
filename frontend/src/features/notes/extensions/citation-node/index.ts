import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CitationNodeView } from "./view";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (attrs: {
        citationId: number;
        sourceId: number;
        sourceTitle: string;
        sourceType: string;
        text: string;
      }) => ReturnType;
    };
  }
}

export const CitationNode = Node.create({
  name: "citation",
  group: "block",
  content: "inline*",
  isolating: true,

  addAttributes() {
    return {
      citationId:  { default: null },
      sourceId:    { default: null },
      sourceTitle: { default: "" },
      sourceType:  { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="citation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "citation" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationNodeView);
  },

  addCommands() {
    return {
      insertCitation:
        ({ citationId, sourceId, sourceTitle, sourceType, text }) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: "citation",
              attrs: { citationId, sourceId, sourceTitle, sourceType },
              content: [{ type: "text", text }],
            })
            .run(),
    };
  },
});
