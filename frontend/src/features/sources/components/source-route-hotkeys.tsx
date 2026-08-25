"use client";

import { useDialogStore } from "@/components/dialogs";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { getSourceRouteHref, getSourceRouteItems, type SourceRouteKey } from "@/features/sources/routes";
import type { SourceDTO } from "@/features/sources/types";
import { useRouter } from "@/lib/nav";

interface SourceRouteHotkeysProps {
  source: SourceDTO;
}

export function SourceRouteHotkeys({ source }: SourceRouteHotkeysProps) {
  const router = useRouter();
  const dialogOpen = useDialogStore((state) => state.open);
  const availableRoutes = new Set(getSourceRouteItems(source).map((item) => item.key));

  const navigateTo = (route: SourceRouteKey) => {
    if (!availableRoutes.has(route)) return;
    router.push(getSourceRouteHref(source.id, route));
  };

  useKeyboardShortcut(() => navigateTo("overview"), {
    key: "O",
    caseSensitive: true,
    enabled: !dialogOpen,
  });

  useKeyboardShortcut(() => navigateTo("takeaways"), {
    key: "K",
    caseSensitive: true,
    enabled: !dialogOpen,
  });

  useKeyboardShortcut(() => navigateTo("highlights"), {
    key: "S",
    caseSensitive: true,
    enabled: !dialogOpen,
  });

  useKeyboardShortcut(() => navigateTo("notes"), {
    key: "N",
    caseSensitive: true,
    enabled: !dialogOpen,
  });

  useKeyboardShortcut(() => navigateTo("transcript"), {
    key: "T",
    caseSensitive: true,
    enabled: !dialogOpen && availableRoutes.has("transcript"),
  });

  useKeyboardShortcut(() => navigateTo("reflect"), {
    key: "R",
    caseSensitive: true,
    enabled: !dialogOpen && availableRoutes.has("reflect"),
  });

  return null;
}
