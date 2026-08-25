"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { CitationNode } from "../extensions/citation-node";
import { SlashExtension } from "../extensions/slash-extension";
import { PickerSheet } from "./picker/picker-sheet";
import { extractCitationIds } from "../utils/extract-refs";
import type { CitationDTO, SourceDTO } from "@/features/sources/types";


export interface EditorControls {
  focus: () => void;
}

interface NoteEditorProps {
  onBodyChange?: (payload: { body: object; citationIds: number[] }) => void;
  onEditorReady?: (controls: EditorControls) => void;
  initialContent?: object;
  sourceId?: number;
  readOnly?: boolean;
}

export function NoteEditor({ onBodyChange, onEditorReady, initialContent, sourceId, readOnly = false }: NoteEditorProps) {
  const contentSeededRef = useRef(!!initialContent);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);

  // Stable ref — safe to close over in useEditor config
  const openCitationPicker = useState<() => void>(() => () => {
    setCitationPickerOpen(true);
  })[0];

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent,
    editable: !readOnly,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write something, or type / to insert a block…",
      }),
      Typography,
      CitationNode,
      ...(readOnly ? [] : [
        SlashExtension.configure({
          onOpenCitationPicker: openCitationPicker,
        }),
      ]),
    ],
    editorProps: {
      attributes: {
        class: readOnly
          ? "outline-none prose prose-neutral dark:prose-invert max-w-none [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg"
          : "outline-none min-h-[calc(100vh-220px)] prose prose-neutral dark:prose-invert max-w-none [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg",
      },
    },
    onUpdate: () => {
      if (!editor || readOnly) return;
      const body = editor.getJSON();
      onBodyChange?.({ body, citationIds: extractCitationIds(body) });
    },
  });

  // Seed editor content once when it arrives asynchronously (hard refresh / direct link)
  useEffect(() => {
    if (editor && initialContent && !contentSeededRef.current) {
      contentSeededRef.current = true;
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady({
        focus: () => editor.commands.focus("start"),
      });
    }
  }, [editor, onEditorReady]);

  const handleCitationSelect = (citation: CitationDTO, source: SourceDTO) => {
    if (!editor) return;
    editor.chain().focus().insertCitation({
      citationId: citation.id,
      sourceId: source.id,
      sourceTitle: source.title ?? "",
      sourceType: source.type ?? "",
      text: citation.text ?? "",
    }).run();
    setCitationPickerOpen(false);
  };

  return (
    <>
      <EditorContent editor={editor} />
      <PickerSheet
        open={citationPickerOpen}
        onOpenChange={setCitationPickerOpen}
        onSelect={handleCitationSelect}
        sourceId={sourceId}
      />
    </>
  );
}
