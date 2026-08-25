"use client";

import {
  FileText,
  Highlighter,
  ListTree,
  MessageSquare,
  NotebookPen,
  Pencil,
  Plus,
  Quote,
  Sparkles,
} from "lucide-react";
import { useRouter } from "@/lib/nav";
import { useDialog, openDialogResult } from "@/components/dialogs";
import { useSource, useSources } from "@/features/sources/hooks/sources";
import { useSourceSections } from "@/features/sources/hooks/sections";
import { EditSourceDialog } from "@/features/sources/dialogs/edit-source-dialog";
import { EditSectionDialog } from "@/features/sources/dialogs/edit-section-dialog";
import { CreateSectionDialog } from "@/features/sources/dialogs/create-section-dialog";
import { getSourceRouteItems } from "@/features/sources/routes";
import type { SourceRouteKey } from "@/features/sources/routes";
import {
  runCreateCitationFlow,
  runCreateCaptureFlow,
  runNavigateToSectionFlow,
} from "../flows/source-flows";
import type { AppState } from "../app-state";
import type { AppCommandAction } from "../types";

const sourceRouteCommandMeta: Record<
  SourceRouteKey,
  Pick<AppCommandAction, "title" | "icon" | "shortcut" | "keywords">
> = {
  overview: {
    title: "Go to Source Overview",
    icon: FileText,
    shortcut: ["s", "o"],
    keywords: ["overview", "summary", "source", "open"],
  },
  takeaways: {
    title: "Go to Source Takeaways",
    icon: Sparkles,
    shortcut: ["s", "k"],
    keywords: ["takeaways", "key takeaways", "insights", "source", "open"],
  },
  highlights: {
    title: "Go to Source Highlights",
    icon: Highlighter,
    shortcut: ["s", "h"],
    keywords: ["highlights", "quotes", "citations", "source", "open"],
  },
  notes: {
    title: "Go to Source Notes",
    icon: NotebookPen,
    shortcut: ["s", "n"],
    keywords: ["notes", "source notes", "open"],
  },
  transcript: {
    title: "Go to Source Transcript",
    icon: FileText,
    shortcut: ["s", "t"],
    keywords: ["transcript", "source", "open"],
  },
  reflect: {
    title: "Go to Source Reflect",
    icon: Sparkles,
    shortcut: ["s", "r"],
    keywords: ["reflect", "reflection", "source", "chat", "open"],
  },
};

export function useSourcePlugin(appState: AppState): AppCommandAction[] {
  const { openDialog } = useDialog();
  const router = useRouter();

  const { data: source } = useSource(appState.sourceId!);
  const { data: sections = [] } = useSourceSections(appState.sourceId);
  const { data: sourcesResponse } = useSources();
  const allSources = sourcesResponse?.sources ?? [];

  if (!appState.sourceId || !source) {
    return [];
  }

  const currentSource = source;
  const routeItems = getSourceRouteItems(currentSource);
  const currentSection =
    appState.currentSectionId && appState.currentSectionId !== "unsorted"
      ? sections.find((section) => section.id === Number(appState.currentSectionId))
      : undefined;

  const actions: AppCommandAction[] = [
    ...routeItems.map((item) => {
      const meta = sourceRouteCommandMeta[item.key];

      return {
        id: `context-source-open-${item.key}`,
        intent: `open-${item.key}`,
        title: meta.title,
        icon: meta.icon,
        keywords: meta.keywords,
        shortcut: meta.shortcut,
        group: "context",
        run: () => router.push(item.href),
      } satisfies AppCommandAction;
    }),
    {
      id: "context-source-add-citation",
      intent: "create-citation",
      title: "Add Source Citation",
      icon: Quote,
      keywords: ["citation", "quote", "highlight", "source", "add", "create"],
      shortcut: ["s", "q"],
      group: "context",
      priority: 120,
      run: () =>
        runCreateCitationFlow({
          allSources,
          source: currentSource,
          sections,
          sourceId: currentSource.id,
          currentSectionId: appState.currentSectionId,
        }),
    },
    {
      id: "context-source-add-capture",
      intent: "create-capture",
      title: "Add Source Comment",
      icon: MessageSquare,
      keywords: ["capture", "comment", "reflection", "note", "add", "create"],
      shortcut: ["s", "c"],
      group: "context",
      priority: 110,
      run: () =>
        runCreateCaptureFlow({
          allSources,
          source: currentSource,
          sourceId: currentSource.id,
          currentSectionId: appState.currentSectionId,
          sections,
        }),
    },
    {
      id: "context-source-add-section",
      intent: "create-section",
      title: "Add Source Section",
      icon: Plus,
      keywords: ["section", "chapter", "source", "add", "create"],
      shortcut: ["s", "a"],
      group: "context",
      priority: 100,
      run: () => void openDialogResult(CreateSectionDialog, { source: currentSource }),
    },
    {
      id: "context-source-open-section",
      intent: "open-section",
      title: "Jump to Source Section",
      icon: ListTree,
      keywords: ["section", "chapter", "source", "jump", "open", "navigate"],
      shortcut: ["s", "j"],
      group: "context",
      run: () =>
        runNavigateToSectionFlow({
          router,
          source: currentSource,
          sections,
        }),
    },
    ...(currentSection
      ? [
          {
            id: "context-source-edit-section",
            intent: "edit-section",
            title: "Edit Section",
            icon: Pencil,
            keywords: [
              "edit",
              "update",
              "rename",
              "section",
              "chapter",
              currentSection.title,
            ],
            group: "context",
            priority: 130,
            run: () =>
              openDialog(EditSectionDialog, {
                sourceId: currentSource.id,
                section: currentSection,
              }),
          } satisfies AppCommandAction,
        ]
      : []),
    {
      id: "context-source-edit",
      intent: "edit-source",
      title: "Edit Source",
      icon: Pencil,
      keywords: ["edit", "update", "rename", "source"],
      shortcut: ["s", "e"],
      group: "context",
      run: () => openDialog(EditSourceDialog, { source: currentSource }),
    },
  ];

  return actions;
}
