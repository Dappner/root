"use client";

import {
  askRagApiAskPost,
  clearReflectSessionRagApiAskReflectSourceIdSessionDelete,
  getModelCatalogRagApiAskModelsGet,
  getAskRagApiAskPostUrl,
  getReflectRagApiAskReflectSourceIdPostUrl,
} from "./rag-api.generated";
import { authenticatedFetch } from "@/lib/fetchers/api-fetcher";
import type {
  AskRequest,
  AskResponse,
  CitationSuggestion,
  ModelCatalog,
  ReflectRequest,
} from "./types";

export type DeltaPayload = {
  text: string;
  citations?: AskResponse["citations"];
};

export type DonePayload = {
  citations?: AskResponse["citations"];
};

export type FollowupsPayload = {
  followups: string[];
};

export type ToolDisplayPayload = {
  label?: string;
  title?: string;
  detail?: string | null;
  summary?: string | null;
  result?: string | null;
};

export type ToolCallPayload = {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
  display?: ToolDisplayPayload;
};

export type ToolResultPayload = {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  metadata?: Record<string, unknown>;
  display?: ToolDisplayPayload;
};

export type SuggestionPayload = {
  suggestion: Record<string, unknown>;
};

export type ReasoningPayload = {
  thought_id: string;
  text: string;
};

export type ReasoningDonePayload = {
  thought_id: string;
  duration_ms?: number | null;
};

// Event names that carry no meaningful payload — stage markers only.
const BARE_EVENTS = new Set(["started", "planning", "reranking", "answering"]);

export type StreamHandlers = {
  onAnswerDelta?: (p: DeltaPayload) => void;
  onFinal?: (p: DonePayload) => void;
  onFollowups?: (p: FollowupsPayload) => void;
  onToolCall?: (p: ToolCallPayload) => void;
  onToolResult?: (p: ToolResultPayload) => void;
  onSuggestion?: (p: SuggestionPayload) => void;
  onSuggestions?: (s: CitationSuggestion[]) => void;
  onReasoning?: (p: ReasoningPayload) => void;
  onReasoningDone?: (p: ReasoningDonePayload) => void;
  onError?: (e: Error) => void;
};

function parseJson(dataLines: string[]): Record<string, unknown> {
  return JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
}

function processStream(
  buffer_ref: { value: string },
  handlers: StreamHandlers & { onSawFinal?: () => void; onHadError?: () => void },
) {
  for (;;) {
    const match = buffer_ref.value.match(/\r?\n\r?\n/);
    if (!match || match.index === undefined) break;

    const rawEvent = buffer_ref.value.slice(0, match.index);
    buffer_ref.value = buffer_ref.value.slice(match.index + match[0].length);
    const lines = rawEvent.split(/\r?\n/);

    let eventName = "";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }

    if (!eventName || dataLines.length === 0) continue;
    if (BARE_EVENTS.has(eventName)) continue; // stage markers — no payload to process

    try {
      const data = parseJson(dataLines);
      switch (eventName) {
        case "delta":
          handlers.onAnswerDelta?.(data as unknown as DeltaPayload);
          break;
        case "tool_call":
          handlers.onToolCall?.(data as unknown as ToolCallPayload);
          break;
        case "tool_result":
          handlers.onToolResult?.(data as unknown as ToolResultPayload);
          break;
        case "answer_done":
        case "done":
          handlers.onSawFinal?.();
          handlers.onFinal?.(data as unknown as DonePayload);
          break;
        case "followups":
          handlers.onFollowups?.(data as unknown as FollowupsPayload);
          break;
        case "suggestions":
          handlers.onSuggestions?.(data.suggestions as CitationSuggestion[]);
          break;
        case "suggestion":
          handlers.onSuggestion?.(data as unknown as SuggestionPayload);
          break;
        case "reasoning":
          handlers.onReasoning?.(data as unknown as ReasoningPayload);
          break;
        case "reasoning_done":
          handlers.onReasoningDone?.(data as unknown as ReasoningDonePayload);
          break;
        case "error":
          handlers.onHadError?.();
          handlers.onError?.(new Error((data.message as string) || "Stream error"));
          break;
      }
    } catch (err) {
      handlers.onHadError?.();
      handlers.onError?.(err as Error);
    }
  }
}

async function consumeStream(
  resp: Response,
  handlers: StreamHandlers,
  onError: (e: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!resp.ok || !resp.body) {
    const error = new Error(`Stream failed: ${resp.status}`);
    onError(error);
    throw error;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const buffer = { value: "" };
  let sawFinal = false;
  let hadError = false;

  const allHandlers = {
    ...handlers,
    onSawFinal: () => { sawFinal = true; },
    onHadError: () => { hadError = true; },
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer.value += decoder.decode(value, { stream: true });
      processStream(buffer, allHandlers);
    }
    buffer.value += decoder.decode();
    processStream(buffer, allHandlers);
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      hadError = true;
      onError(err as Error);
      throw err;
    }
  } finally {
    reader.releaseLock();
    if (!sawFinal && !hadError && signal?.aborted !== true) {
      onError(new Error("Stream ended unexpectedly"));
    }
  }
}

export const ragApi = {
  async getModelCatalog(): Promise<ModelCatalog> {
    const response = await getModelCatalogRagApiAskModelsGet();
    if (response.status !== 200) {
      throw new Error("Model catalog was not available");
    }
    return response.data;
  },

  async ask(request: AskRequest): Promise<AskResponse> {
    const response = await askRagApiAskPost(request);
    return response.data as AskResponse;
  },

  async askStream(
    request: AskRequest,
    handlers: StreamHandlers,
    options?: RequestInit,
  ): Promise<void> {
    const resp = await authenticatedFetch(`${getAskRagApiAskPostUrl()}?stream=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...options?.headers },
      body: JSON.stringify(request),
      signal: options?.signal,
    });
    await consumeStream(resp, handlers, handlers.onError ?? (() => {}), options?.signal as AbortSignal);
  },

  async reflectStream(
    sourceId: number,
    request: ReflectRequest,
    handlers: StreamHandlers,
    options?: RequestInit,
  ): Promise<void> {
    const resp = await authenticatedFetch(getReflectRagApiAskReflectSourceIdPostUrl(sourceId), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...options?.headers },
      body: JSON.stringify(request),
      signal: options?.signal,
    });
    await consumeStream(resp, handlers, handlers.onError ?? (() => {}), options?.signal as AbortSignal);
  },

  async clearReflectSession(sourceId: number): Promise<void> {
    await clearReflectSessionRagApiAskReflectSourceIdSessionDelete(sourceId);
  },
};
