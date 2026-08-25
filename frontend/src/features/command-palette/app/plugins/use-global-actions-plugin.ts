"use client";

import { MessageSquare, Plus, Quote, Sparkles } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { useAssistantPanel } from "@/features/assistant";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";
import { useSources } from "@/features/sources/hooks/sources";
import {
  runCreateCitationFlow,
  runCreateCaptureFlow,
} from "../flows/source-flows";
import type { AppState } from "../app-state";
import type { AppCommandAction } from "../types";

export function useGlobalActionsPlugin(appState: AppState): AppCommandAction[] {
  const { openDialog } = useDialog();
  const openAssistant = useAssistantPanel((state) => state.openAssistant);
  const { data: sourcesResponse } = useSources();
  const allSources = sourcesResponse?.sources ?? [];

  const assistantContext =
    appState.sourceId && appState.currentSectionId && appState.currentSectionId !== "unsorted"
      ? {
          surface: "section" as const,
          source_id: appState.sourceId,
          section_id: Number(appState.currentSectionId),
        }
      : appState.sourceId
        ? { surface: "source" as const, source_id: appState.sourceId }
        : { surface: "library" as const };

  return [
    {
      id: "action-ask-assistant",
      intent: "ask-assistant",
      title: "Ask Assistant",
      icon: Sparkles,
      keywords: ["ask", "assistant", "chat", "ai", "question"],
      shortcut: ["a", "a"],
      group: "actions",
      priority: 80,
      run: () => openAssistant({ context: assistantContext }),
    },
    {
      id: "action-new-source",
      intent: "create-source",
      title: "Create Source",
      icon: Plus,
      keywords: ["new", "create", "add", "source", "book", "article"],
      shortcut: ["c", "s"],
      group: "actions",
      priority: 50,
      run: () => openDialog(CreateSourceDialog),
    },
    {
      id: "action-new-citation",
      intent: "create-citation",
      title: "Create Citation",
      icon: Quote,
      keywords: ["citation", "quote", "highlight", "add", "create"],
      shortcut: ["c", "c"],
      group: "actions",
      priority: 40,
      run: () => runCreateCitationFlow({ allSources }),
    },
    {
      id: "action-new-capture",
      intent: "create-capture",
      title: "Add Comment",
      icon: MessageSquare,
      keywords: ["capture", "comment", "reflection", "note", "add", "create"],
      shortcut: ["c", "r"],
      group: "actions",
      priority: 30,
      run: () => runCreateCaptureFlow({ allSources }),
    },
  ];
}
