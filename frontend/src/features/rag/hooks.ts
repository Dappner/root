"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type {
  DonePayload,
  ReasoningDonePayload,
  ReasoningPayload,
  StreamHandlers,
  ToolCallPayload,
  ToolResultPayload,
} from "./api";
import { ragApi } from "./api";
import type { AskRequest, ChatItem, RagCitation } from "./types";

export function useModelCatalog() {
  return useQuery({
    queryKey: ["rag", "model-catalog"],
    queryFn: () => ragApi.getModelCatalog(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: (request: AskRequest) => ragApi.ask(request),
  });
}

let idCounter = 0;
const nextId = () => `item-${++idCounter}`;

const LIVE_ID = "live" as const;
const ASK_HISTORY_LIMIT = 12;

function normalizeToolName(name: string) {
  return name
    .replace(/Schema$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll("-", "_")
    .toLowerCase();
}

function isSuggestionTool(name: string) {
  const normalized = normalizeToolName(name);
  return (
    normalized === "suggest_create_capture" ||
    normalized === "suggest_create_citation" ||
    normalized === "suggest_update_section_summary" ||
    normalized === "suggest_create_takeaway"
  );
}

function suggestionFromToolResult(payload: ToolResultPayload): Record<string, unknown> | null {
  const normalized = normalizeToolName(payload.name);
  const metadataSuggestion = payload.metadata?.suggestion;
  if (metadataSuggestion && typeof metadataSuggestion === "object") {
    return metadataSuggestion as Record<string, unknown>;
  }

  if (normalized === "suggest_create_capture") {
    return { type: "create_capture", ...payload.args };
  }

  if (normalized === "suggest_create_citation") {
    return { type: "create_citation", ...payload.args };
  }

  if (normalized === "suggest_update_section_summary") {
    return { type: "update_section_summary", ...payload.args };
  }

  if (normalized === "suggest_create_takeaway") {
    return { type: "create_takeaway", ...payload.args };
  }

  return null;
}

function appendSuggestionIfNew(items: ChatItem[], suggestion: Record<string, unknown>) {
  const serialized = JSON.stringify(suggestion);
  const exists = items.some(
    (item) =>
      item.kind === "assistant_suggestion" &&
      JSON.stringify(item.suggestion) === serialized,
  );
  if (exists) return items;
  return [...items, { kind: "assistant_suggestion" as const, id: nextId(), suggestion }];
}

/**
 * Appends a reasoning delta, starting a new item for a thought id we have not
 * seen. Providers emit several discrete thoughts per turn, so each one becomes
 * its own panel rather than accumulating into a single running blob.
 */
function appendReasoningDelta(
  items: ChatItem[],
  payload: ReasoningPayload,
): ChatItem[] {
  const idx = items.findIndex(
    (item) => item.kind === "reasoning" && item.thoughtId === payload.thought_id,
  );

  if (idx === -1) {
    return [
      ...items,
      {
        kind: "reasoning" as const,
        id: nextId(),
        thoughtId: payload.thought_id,
        text: payload.text,
        streaming: true,
      },
    ];
  }

  const existing = items[idx] as Extract<ChatItem, { kind: "reasoning" }>;
  const updated: ChatItem = { ...existing, text: existing.text + payload.text };
  return [...items.slice(0, idx), updated, ...items.slice(idx + 1)];
}

/** Settles a reasoning item, recording how long the thought took. */
function settleReasoning(
  items: ChatItem[],
  payload: ReasoningDonePayload,
): ChatItem[] {
  return items.map((item) =>
    item.kind === "reasoning" && item.thoughtId === payload.thought_id
      ? {
          ...item,
          streaming: false,
          durationMs: payload.duration_ms ?? undefined,
        }
      : item,
  );
}

/**
 * Marks every in-flight reasoning item as settled.
 *
 * Providers do not always emit a closing thought event — a stream that ends
 * mid-thought, or is cancelled, would otherwise leave a panel shimmering
 * forever.
 */
function settleAllReasoning(items: ChatItem[]): ChatItem[] {
  return items.map((item) =>
    item.kind === "reasoning" && item.streaming ? { ...item, streaming: false } : item,
  );
}

function getSuggestionText(suggestion: Record<string, unknown>) {
  if (typeof suggestion.summary === "string") return suggestion.summary;
  if (typeof suggestion.text === "string") return suggestion.text;
  return "";
}

function stripDuplicateSuggestionText(
  text: string,
  items: ChatItem[],
) {
  const suggestionTexts = items
    .filter((item): item is Extract<ChatItem, { kind: "assistant_suggestion" }> =>
      item.kind === "assistant_suggestion"
    )
    .map((item) => getSuggestionText(item.suggestion))
    .filter((value) => value.length > 80);

  let nextText = text;
  for (const suggestionText of suggestionTexts) {
    const quoted = `"${suggestionText}"`;
    nextText = nextText.replace(quoted, "").replace(suggestionText, "");
  }

  nextText = nextText
    .replace(/Suggested summary \(for review\):\s*/gi, "")
    .replace(/Confidence:\s*(low|medium|high)\.?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return nextText || "I've prepared a suggestion for you to review.";
}

function buildAskHistory(items: ChatItem[]): AskRequest["history"] {
  return items
    .filter(
      (
        item,
      ): item is Extract<ChatItem, { kind: "user_message" | "assistant_message" }> =>
        item.kind === "user_message" || item.kind === "assistant_message",
    )
    .map((item) => ({
      role: item.kind === "user_message" ? "user" as const : "assistant" as const,
      content: item.text,
    }))
    .filter((message) => message.content.trim().length > 0)
    .slice(-ASK_HISTORY_LIMIT);
}

// ─── Shared item reducers ────────────────────────────────────────────────────

function appendToolCall(items: ChatItem[], payload: ToolCallPayload): ChatItem[] {
  return [
    ...items,
    {
      kind: "tool_call",
      id: nextId(),
      callId: payload.call_id,
      name: payload.name,
      args: payload.args,
      status: "pending",
      display: payload.display,
    },
  ];
}

function resolveToolCall(items: ChatItem[], payload: ToolResultPayload): ChatItem[] {
  const suggestion = suggestionFromToolResult(payload);

  // Suggestion tools are presented as their resulting card, not as a tool call,
  // so drop the placeholder row rather than resolving it.
  const withoutSuggestionTool = items.filter(
    (item) =>
      !(
        item.kind === "tool_call" &&
        item.callId === payload.call_id &&
        isSuggestionTool(payload.name)
      ),
  );

  if (suggestion) {
    return appendSuggestionIfNew(withoutSuggestionTool, suggestion);
  }

  return withoutSuggestionTool.map((item) =>
    item.kind === "tool_call" && item.callId === payload.call_id
      ? {
          ...item,
          status: "done" as const,
          summary: payload.summary,
          metadata: payload.metadata,
          display: payload.display ?? item.display,
        }
      : item,
  );
}

/** Creates or extends the single live answer item. */
function appendAnswerDelta(
  items: ChatItem[],
  delta: { text: string; citations?: Record<string, RagCitation> },
): ChatItem[] {
  const liveIdx = items.findIndex((item) => item.id === LIVE_ID);

  if (liveIdx === -1) {
    return [
      ...items,
      {
        kind: "streaming_answer" as const,
        id: LIVE_ID,
        text: delta.text,
        citations: delta.citations,
      },
    ];
  }

  const live = items[liveIdx] as Extract<ChatItem, { kind: "streaming_answer" }>;
  const updated: ChatItem = {
    ...live,
    text: live.text + delta.text,
    citations: { ...live.citations, ...delta.citations },
  };
  return [...items.slice(0, liveIdx), updated, ...items.slice(liveIdx + 1)];
}

/** Converts the live answer into a settled assistant message. */
function finalizeAnswer(items: ChatItem[], done: DonePayload): ChatItem[] {
  const hasSuggestions = items.some((item) => item.kind === "assistant_suggestion");

  return items.map((item) => {
    if (item.id !== LIVE_ID) return item;
    const live = item as Extract<ChatItem, { kind: "streaming_answer" }>;
    return {
      kind: "assistant_message" as const,
      id: nextId(),
      text: hasSuggestions ? stripDuplicateSuggestionText(live.text, items) : live.text,
      citations: done.citations || live.citations,
    };
  });
}

function attachFollowups(items: ChatItem[], followups: string[]): ChatItem[] {
  const idx = items.findLastIndex((item) => item.kind === "assistant_message");
  if (idx === -1) return items;
  const item = items[idx];
  if (item.kind !== "assistant_message") return items;
  return [...items.slice(0, idx), { ...item, followups }, ...items.slice(idx + 1)];
}

/** Fails any tool call still pending when the stream dies. */
function failPendingToolCalls(items: ChatItem[], message: string): ChatItem[] {
  return items.map((item) =>
    item.kind === "tool_call" && item.status === "pending"
      ? { ...item, status: "error" as const, error: message }
      : item,
  );
}

// ─── useChatStream ───────────────────────────────────────────────────────────

type RunStream = (
  items: ChatItem[],
  handlers: StreamHandlers,
  options: { signal: AbortSignal },
) => Promise<void>;

interface ChatStreamConfig {
  /** Handlers merged over the shared set — for surface-specific events. */
  extraHandlers?: (update: (fn: (items: ChatItem[]) => ChatItem[]) => void) => Partial<StreamHandlers>;
  /** Extra teardown on reset, e.g. clearing a server-side session. */
  onReset?: () => void;
}

/**
 * Shared SSE-to-chat-items engine behind the ask and reflect surfaces.
 *
 * Both surfaces consume the same event vocabulary and build the same item list;
 * they differ only in which endpoint they call, whether history is sent from the
 * client, and what needs clearing on reset. Those differences arrive via the
 * `run` callback and this config rather than by duplicating the handler set.
 */
function useChatStream({ extraHandlers, onReset }: ChatStreamConfig = {}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  // Mirrors `items` so senders can read the current list without re-creating
  // their callback on every delta.
  const itemsRef = useRef<ChatItem[]>([]);

  const update = useCallback((fn: (items: ChatItem[]) => ChatItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const fail = useCallback(
    (err: Error) => {
      setIsLoading(false);
      setError(err);
      update((prev) => settleAllReasoning(failPendingToolCalls(prev, err.message)));
    },
    [update],
  );

  const send = useCallback(
    async (question: string, run: RunStream) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setError(null);
      setIsLoading(true);
      update((prev) => [...prev, { kind: "user_message", id: nextId(), text: question }]);

      const handlers: StreamHandlers = {
        onToolCall: (payload) => {
          if (isSuggestionTool(payload.name)) return;
          update((prev) => appendToolCall(prev, payload));
        },
        onToolResult: (payload) => update((prev) => resolveToolCall(prev, payload)),
        onSuggestion: ({ suggestion }) =>
          update((prev) => appendSuggestionIfNew(prev, suggestion)),
        onReasoning: (payload: ReasoningPayload) =>
          update((prev) => appendReasoningDelta(prev, payload)),
        onReasoningDone: (payload: ReasoningDonePayload) =>
          update((prev) => settleReasoning(prev, payload)),
        onAnswerDelta: (delta) => update((prev) => appendAnswerDelta(prev, delta)),
        onFinal: (done: DonePayload) => {
          setIsLoading(false);
          // Providers do not always close a thought before the answer lands.
          update((prev) => settleAllReasoning(finalizeAnswer(prev, done)));
        },
        onFollowups: ({ followups }) => update((prev) => attachFollowups(prev, followups)),
        onError: fail,
        ...extraHandlers?.(update),
      };

      try {
        await run(itemsRef.current, handlers, { signal: controller.signal });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          fail(err as Error);
        }
      }
    },
    [update, fail, extraHandlers],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsLoading(false);
    update(settleAllReasoning);
  }, [update]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    onReset?.();
    update(() => []);
    setIsLoading(false);
    setError(null);
  }, [update, onReset]);

  return { items, isLoading, error, send, cancel, reset };
}

// ─── useAskStream ─────────────────────────────────────────────────────────────

export function useAskStream() {
  const { send, ...rest } = useChatStream();

  const start = useCallback(
    (request: AskRequest) =>
      send(request.question, (items, handlers, options) =>
        ragApi.askStream(
          // Ask is stateless server-side, so prior turns are replayed from the
          // client's own item list.
          { ...request, history: request.history ?? buildAskHistory(items) },
          handlers,
          options,
        ),
      ),
    [send],
  );

  return { ...rest, start };
}

// ─── useReflectStream ─────────────────────────────────────────────────────────

export function useReflectStream(sourceId: number) {
  const extraHandlers = useCallback(
    (update: (fn: (items: ChatItem[]) => ChatItem[]) => void): Partial<StreamHandlers> => ({
      // Citation probes are reflect-only — the ask backend never emits them.
      onSuggestions: (newSuggestions) =>
        update((prev) =>
          newSuggestions.reduce(
            (next, suggestion) =>
              appendSuggestionIfNew(next, { type: "citation_probe", ...suggestion }),
            prev,
          ),
        ),
    }),
    [],
  );

  const onReset = useCallback(() => {
    void ragApi.clearReflectSession(sourceId).catch(() => {});
  }, [sourceId]);

  const { send, ...rest } = useChatStream({ extraHandlers, onReset });

  const sendReflect = useCallback(
    (question: string, model_config?: AskRequest["model_config"]) =>
      // Reflect keeps history server-side, so no items are replayed.
      send(question, (_items, handlers, options) =>
        ragApi.reflectStream(sourceId, { question, model_config }, handlers, options),
      ),
    [send, sourceId],
  );

  return { ...rest, send: sendReflect };
}
