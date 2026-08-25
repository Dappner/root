import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/config";
import type {
  AskRequest,
  DeltaPayload,
  DonePayload,
  ResumeAckPayload,
  StreamHandlers,
} from "./types";

const BARE_EVENTS = new Set(["started", "planning", "reasoning", "reranking", "answering"]);

function parseJson(lines: string[]) {
  return JSON.parse(lines.join("\n")) as Record<string, unknown>;
}

function processStream(buffer: { value: string }, handlers: StreamHandlers) {
  for (;;) {
    const match = buffer.value.match(/\r?\n\r?\n/);
    if (!match || match.index === undefined) {
      break;
    }

    const rawEvent = buffer.value.slice(0, match.index);
    buffer.value = buffer.value.slice(match.index + match[0].length);

    const lines = rawEvent.split(/\r?\n/);
    let eventName = "";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!eventName || dataLines.length === 0) {
      continue;
    }

    try {
      const data = parseJson(dataLines);

      if (typeof data.seq === "number") {
        handlers.onSeq?.(data.seq);
      }

      if (BARE_EVENTS.has(eventName)) {
        continue;
      }

      if (eventName === "delta") {
        handlers.onAnswerDelta?.(data as unknown as DeltaPayload);
      } else if (eventName === "answer_done" || eventName === "done") {
        handlers.onFinal?.(data as unknown as DonePayload);
      } else if (eventName === "resume_ack") {
        handlers.onResumeAck?.(data as unknown as ResumeAckPayload);
      } else if (eventName === "error") {
        handlers.onError?.(new Error((data.message as string) || "Stream error"));
      }
    } catch (error) {
      handlers.onError?.(error as Error);
    }
  }
}

export type AskStreamOptions = {
  requestId: string;
  handlers: StreamHandlers;
  signal?: AbortSignal;
};

export type ResumeStreamOptions = {
  requestId: string;
  fromSeq: number;
  handlers: StreamHandlers;
  signal?: AbortSignal;
};

export const askApi = {
  async askStream(request: AskRequest, options: AskStreamOptions) {
    const cookies = authClient.getCookie();
    const url = `${API_URL}/rag-api/ask?stream=1`;
    const body = { ...request, request_id: options.requestId };
    await sseXhr({
      method: "POST",
      url,
      cookies,
      body: JSON.stringify(body),
      handlers: options.handlers,
      signal: options.signal,
    });
  },

  async resumeStream(options: ResumeStreamOptions) {
    const cookies = authClient.getCookie();
    const url =
      `${API_URL}/rag-api/ask/${encodeURIComponent(options.requestId)}/stream` +
      `?from_seq=${options.fromSeq}`;
    await sseXhr({
      method: "GET",
      url,
      cookies,
      handlers: options.handlers,
      signal: options.signal,
      lastEventId: options.fromSeq >= 0 ? String(options.fromSeq) : undefined,
    });
  },
};

function createAbortError() {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}

type SseXhrOptions = {
  method: "GET" | "POST";
  url: string;
  cookies: string;
  body?: string;
  handlers: StreamHandlers;
  signal?: AbortSignal;
  lastEventId?: string;
};

function sseXhr(options: SseXhrOptions) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const buffer = { value: "" };
    let seenLength = 0;
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const consume = () => {
      const nextText = xhr.responseText.slice(seenLength);
      seenLength = xhr.responseText.length;
      if (!nextText) return;
      buffer.value += nextText;
      processStream(buffer, options.handlers);
    };

    const onAbort = () => {
      xhr.abort();
      settle(() => reject(createAbortError()));
    };

    xhr.open(options.method, options.url);
    xhr.setRequestHeader("Accept", "text/event-stream");
    if (options.method === "POST") {
      xhr.setRequestHeader("Content-Type", "application/json");
    }
    if (options.lastEventId) {
      xhr.setRequestHeader("Last-Event-ID", options.lastEventId);
    }
    if (options.cookies) {
      xhr.setRequestHeader("Cookie", options.cookies);
    }

    xhr.onprogress = consume;
    xhr.onload = () => {
      consume();
      processStream(buffer, options.handlers);
      if (xhr.status >= 200 && xhr.status < 300) {
        settle(resolve);
      } else {
        const err = new Error(`Ask stream failed: ${xhr.status}`);
        (err as Error & { status?: number }).status = xhr.status;
        settle(() => reject(err));
      }
    };
    xhr.onerror = () => {
      const err = new Error(`Ask stream network error: ${xhr.status || "unknown"}`);
      (err as Error & { status?: number; isNetworkError?: boolean }).isNetworkError = true;
      settle(() => reject(err));
    };
    xhr.onabort = () => {
      settle(() => reject(createAbortError()));
    };

    options.signal?.addEventListener("abort", onAbort);
    xhr.send(options.body ?? null);
  });
}
