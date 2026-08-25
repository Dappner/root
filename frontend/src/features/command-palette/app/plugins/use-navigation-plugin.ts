"use client";

import {
  BookOpen,
  Home,
  Layers,
  MessageCircle,
  Mic,
  Network,
  NotebookPen,
  Shield,
  User,
} from "lucide-react";
import { useRouter } from "@/lib/nav";
import { createPicker, openPickerResultAsync } from "@/components/pickers";
import { routes } from "@/lib/routes";
import type { CollectionDTO } from "@/features/collections/types";
import type { ShowDTO } from "@/features/podcasts/types";
import { useSources } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { useCollections } from "@/features/collections/hooks";
import { usePodcastShows } from "@/features/podcasts/hooks";
import type { AppState } from "../app-state";
import type { AppCommandAction } from "../types";

const sourceNavigationPicker = createPicker<SourceDTO>({
  id: "source-navigation-picker",
  getKey: (item) => String(item.id),
  getLabel: (item) => item.title ?? "Untitled",
  getKeywords: (item) =>
    [item.title, item.author, item.type].filter((value): value is string => Boolean(value)),
});

const collectionNavigationPicker = createPicker<CollectionDTO>({
  id: "collection-navigation-picker",
  getKey: (item) => String(item.id),
  getLabel: (item) => item.name ?? "Untitled",
  getKeywords: (item) =>
    [item.name, item.description].filter((value): value is string => Boolean(value)),
});

const showNavigationPicker = createPicker<ShowDTO>({
  id: "show-navigation-picker",
  getKey: (item) => item.slug ?? "",
  getLabel: (item) => item.title ?? "Untitled",
  getKeywords: (item) =>
    [item.title, item.author].filter((value): value is string => Boolean(value)),
});

async function navigateToSource(sources: SourceDTO[], router: ReturnType<typeof useRouter>) {
  const selection = await openPickerResultAsync(sourceNavigationPicker, {
    title: "Go to Source",
    items: sources.filter((source) => source.id != null),
    actions: [
      { id: "overview", label: "Library (Overview)", description: "Browse all sources" },
    ],
  });

  if (selection.kind === "cancel" || selection.kind === "back") return;

  if (selection.kind === "action") {
    router.push(routes.library);
    return;
  }

  router.push(routes.source(selection.item.id));
}

async function navigateToCollection(
  collections: CollectionDTO[],
  router: ReturnType<typeof useRouter>,
) {
  const selection = await openPickerResultAsync(collectionNavigationPicker, {
    title: "Go to Collection",
    items: collections.filter((collection) => collection.id != null),
    actions: [
      {
        id: "overview",
        label: "Collections (Overview)",
        description: "Browse all collections",
      },
    ],
  });

  if (selection.kind === "cancel" || selection.kind === "back") return;

  if (selection.kind === "action") {
    router.push(routes.collections);
    return;
  }

  router.push(routes.collection(selection.item.id));
}

async function navigateToShow(shows: ShowDTO[], router: ReturnType<typeof useRouter>) {
  const selection = await openPickerResultAsync(showNavigationPicker, {
    title: "Go to Podcast",
    items: shows.filter((show) => Boolean(show.slug)),
    actions: [
      { id: "overview", label: "Podcasts (Overview)", description: "Browse all shows" },
    ],
  });

  if (selection.kind === "cancel" || selection.kind === "back") return;

  if (selection.kind === "action") {
    router.push(routes.discoverPodcasts);
    return;
  }

  router.push(routes.discoverPodcastShow(selection.item.slug ?? ""));
}

export function useNavigationPlugin(appState: AppState): AppCommandAction[] {
  const router = useRouter();
  const { data: sourcesResponse } = useSources();
  const { data: allCollections = [] } = useCollections();
  const { data: showsResponse } = usePodcastShows();

  const allSources = sourcesResponse?.sources ?? [];
  const allShows = showsResponse?.data ?? [];

  return [
    {
      id: "nav-home",
      intent: "nav-home",
      title: "Go to Home",
      icon: Home,
      keywords: ["home", "dashboard"],
      shortcut: ["g", "h"],
      group: "navigation",
      priority: 300,
      isRedundant: () => appState.pathname === "/",
      run: () => router.push(routes.root),
    },
    {
      id: "nav-library",
      intent: "nav-library",
      title: "Go to Source",
      icon: BookOpen,
      keywords: ["library", "source", "book", "article"],
      shortcut: ["g", "s"],
      group: "navigation",
      priority: 290,
      run: () => navigateToSource(allSources, router),
    },
    {
      id: "nav-collections",
      intent: "nav-collections",
      title: "Go to Collection",
      icon: Layers,
      keywords: ["collections", "collection", "group"],
      shortcut: ["g", "c"],
      group: "navigation",
      priority: 270,
      run: () => navigateToCollection(allCollections, router),
    },
    {
      id: "nav-podcasts",
      intent: "nav-podcasts",
      title: "Go to Podcast",
      icon: Mic,
      keywords: ["podcast", "show", "episodes", "discover"],
      shortcut: ["g", "p"],
      group: "navigation",
      priority: 260,
      run: () => navigateToShow(allShows, router),
    },
    {
      id: "nav-ask",
      intent: "nav-ask",
      title: "Go to Ask",
      icon: MessageCircle,
      keywords: ["ask", "question", "query", "chat", "rag"],
      shortcut: ["g", "a"],
      group: "navigation",
      priority: 230,
      isRedundant: () => appState.pathname === "/ask",
      run: () => router.push(routes.ask),
    },
    {
      id: "nav-notes",
      intent: "nav-notes",
      title: "Go to Notes",
      icon: NotebookPen,
      keywords: ["notes", "note", "writing"],
      shortcut: ["g", "n"],
      group: "navigation",
      priority: 280,
      isRedundant: () => appState.pathname === "/notes",
      run: () => router.push(routes.notes),
    },
    {
      id: "nav-graph",
      intent: "nav-graph",
      title: "Go to Graph",
      icon: Network,
      keywords: ["graph", "network", "connections", "visualize"],
      shortcut: ["g", "g"],
      group: "navigation",
      priority: 275,
      isRedundant: () => appState.pathname === "/graph",
      run: () => router.push(routes.graph),
    },
    {
      id: "nav-admin",
      intent: "nav-admin",
      title: "Go to Admin",
      icon: Shield,
      keywords: ["admin", "administration"],
      shortcut: ["g", "d"],
      group: "navigation",
      priority: 220,
      isRedundant: () => appState.pathname === "/admin",
      run: () => router.push(routes.admin),
    },
    {
      id: "nav-profile",
      intent: "nav-profile",
      title: "Go to Profile",
      icon: User,
      keywords: ["profile", "settings", "account"],
      shortcut: ["g", "u"],
      group: "navigation",
      priority: 240,
      isRedundant: () => appState.pathname === "/profile",
      run: () => router.push(routes.profile),
    },
  ];
}
