"use client";

import { BookOpen, Layers } from "lucide-react";
import { CommandPalette as CommandPaletteUI } from "@/components/command-palette/command-palette";
import { CommandPaletteKeyboardListener as KeyboardListenerUI } from "@/components/command-palette/keyboard-listener";
import { useCommandPalette } from "@/components/command-palette/store";
import { useSource } from "@/features/sources/hooks/sources";
import { useCollection } from "@/features/collections/hooks";
import { useCommandPaletteGlobalShortcutConfig } from "./preferences";
import { useCommandPaletteState } from "./use-command-palette-state";

export function CommandPalette() {
  const isOpen = useCommandPalette((state) => state.isOpen);
  const close = useCommandPalette((state) => state.close);

  const config = useCommandPaletteGlobalShortcutConfig();
  const { contexts, sections, actions } = useCommandPaletteState(true);

  const activeContext = contexts.find(
    (c) => c.type === "source" || c.type === "collection",
  );

  const { data: source } = useSource(
    activeContext?.type === "source" ? activeContext.sourceId : 0,
  );
  const { data: collection } = useCollection(
    activeContext?.type === "collection" ? activeContext.collectionId : 0,
  );

  const breadcrumb = (() => {
    if (!activeContext) return null;
    if (activeContext.type === "source" && source) {
      return { icon: BookOpen, label: "Source", name: source.title ?? "Untitled" };
    }
    if (activeContext.type === "collection" && collection) {
      return { icon: Layers, label: "Collection", name: collection.name };
    }
    return null;
  })();

  return (
    <>
      <CommandPaletteUI
        isOpen={isOpen}
        onClose={close}
        sections={sections}
        breadcrumb={breadcrumb}
        leaderKey={config.mode === "leader" ? config.leaderKey : undefined}
      />
      <KeyboardListenerUI actions={actions} config={config} />
    </>
  );
}
