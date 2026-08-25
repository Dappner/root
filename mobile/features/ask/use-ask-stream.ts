import { useCallback, useRef, useState } from "react";
import { askApi } from "./api";
import type { ChatMessage, RagCitation, StreamHandlers } from "./types";

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isResumableError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; isNetworkError?: boolean; status?: number };
  if (e.name === "AbortError") return false;
  if (e.isNetworkError) return true;
  if (typeof e.status === "number" && e.status >= 500) return true;
  return false;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort);
  });
}

type AskStreamState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  isReconnecting: boolean;
  error: string | null;
};

export function useAskStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateAssistant = useCallback(
    (id: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) =>
        current.map((message) => (message.id === id ? updater(message) : message))
      );
    },
    []
  );

  const ask = useCallback(
    async (question: string) => {
      if (!question || isStreaming) return;

      const userMessage: ChatMessage = { id: makeId(), role: "user", text: question };
      const assistantId = makeId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        citations: {},
      };

      setMessages((current) => [...current, userMessage, assistantMessage]);
      setError(null);
      setIsStreaming(true);
      setIsReconnecting(false);

      const controller = new AbortController();
      abortRef.current = controller;

      const requestId = makeId();
      let lastSeq = -1;
      let done = false;

      const mergeCitations = (citations?: Record<string, RagCitation>) => {
        if (!citations) return;
        updateAssistant(assistantId, (m) => ({
          ...m,
          citations: { ...m.citations, ...citations },
        }));
      };

      const handlers: StreamHandlers = {
        onSeq: (seq) => {
          if (seq > lastSeq) lastSeq = seq;
        },
        onAnswerDelta: (delta) => {
          updateAssistant(assistantId, (m) => ({
            ...m,
            text: m.text + delta.text,
            citations: { ...m.citations, ...delta.citations },
          }));
        },
        onFinal: (donePayload) => {
          done = true;
          mergeCitations(donePayload.citations);
        },
        onError: (streamError) => setError(streamError.message),
      };

      // Reuse the recent context (excluding the just-appended placeholders)
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.text }));

      try {
        await askApi.askStream(
          { question, context: { surface: "ask" }, history },
          { requestId, handlers, signal: controller.signal }
        );

        if (!done && !controller.signal.aborted) {
          try {
            await askApi.resumeStream({
              requestId,
              fromSeq: lastSeq,
              handlers,
              signal: controller.signal,
            });
          } catch {
            /* best-effort */
          }
        }
      } catch (streamError) {
        if ((streamError as Error).name === "AbortError") {
          // user stopped
        } else if (isResumableError(streamError) && !done) {
          let attempt = 0;
          let surfaced = false;
          while (!done && !controller.signal.aborted && attempt < RECONNECT_DELAYS_MS.length) {
            setIsReconnecting(true);
            try {
              await sleep(RECONNECT_DELAYS_MS[attempt], controller.signal);
            } catch {
              break;
            }
            attempt += 1;
            try {
              await askApi.resumeStream({
                requestId,
                fromSeq: lastSeq,
                handlers,
                signal: controller.signal,
              });
              break;
            } catch (resumeErr) {
              if ((resumeErr as Error).name === "AbortError") break;
              const status = (resumeErr as { status?: number }).status;
              if (status === 404 || status === 403 || status === 410) {
                setError("Lost connection and could not resume — please retry.");
                surfaced = true;
                break;
              }
            }
          }
          if (!done && !controller.signal.aborted && !surfaced) {
            setError("Lost connection — please retry.");
          }
        } else {
          setError((streamError as Error).message);
        }
      } finally {
        setIsStreaming(false);
        setIsReconnecting(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, updateAssistant]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setIsReconnecting(false);
  }, []);

  return { messages, isStreaming, isReconnecting, error, ask, stop, reset } satisfies AskStreamState & {
    ask: (q: string) => Promise<void>;
    stop: () => void;
    reset: () => void;
  };
}
