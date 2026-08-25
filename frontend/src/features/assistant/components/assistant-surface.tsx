"use client";

import { ReasoningPanel } from "@/components/ai/reasoning-panel";
import { ShimmerLabel } from "@/components/ai/streaming-text";
import { Button } from "@/components/ui/button";
import { AskInput } from "@/features/rag/components/ask-input";
import { AssistantMessage } from "@/features/rag/components/assistant-message";
import { useModelSelection } from "@/features/rag/components/model-selector";
import { ToolCallItem } from "@/features/rag/components/tool-call";
import { UserMessage } from "@/features/rag/components/user-message";
import { useAskStream, useReflectStream } from "@/features/rag/hooks";
import { cn } from "@/lib/utils";
import { Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RootAssistantContext } from "../types";
import {
  buildModelConfig,
  getAssistantContextLabel,
  transformAssistantMessage,
} from "../utils";
import { AssistantSuggestionCard } from "./assistant-suggestion-card";

interface AssistantSurfaceProps {
  context: RootAssistantContext;
  variant: "page" | "panel";
  initialDraft?: string;
  mode?: "ask" | "reflect";
  onClose?: () => void;
}

export function AssistantSurface({
  context,
  variant,
  initialDraft = "",
  mode = "ask",
  onClose,
}: AssistantSurfaceProps) {
  const [question, setQuestion] = useState(initialDraft);
  const askStream = useAskStream();
  const reflectStream = useReflectStream(context.source_id ?? 0);
  const activeStream = mode === "reflect" ? reflectStream : askStream;
  const { items, isLoading, error, cancel, reset } = activeStream;
  const {
    models,
    modelId,
    setModel,
    selectedModel,
    reasoningLevel,
    setReasoningLevel,
    isModelReady,
    modelCatalogError,
  } = useModelSelection();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuestion(initialDraft);
  }, [initialDraft]);

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  const submitQuestion = (rawQuestion: string) => {
    if (!rawQuestion.trim() || !selectedModel) return;

    const transformedQuestion = transformAssistantMessage(rawQuestion);
    const modelConfig = buildModelConfig(selectedModel, reasoningLevel);
    if (mode === "reflect") {
      reflectStream.send(transformedQuestion, modelConfig);
    } else {
      askStream.start({
        question: transformedQuestion,
        model_config: modelConfig,
        context,
      });
    }
    setQuestion("");
    requestAnimationFrame(scrollToBottom);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitQuestion(question);
  };

  const hasConversation = items.length > 0 || isLoading;
  const hasToolCalls = items.some((item) => item.kind === "tool_call");
  const hasStreamingReasoning = items.some(
    (item) => item.kind === "reasoning" && item.streaming,
  );
  const compact = variant === "panel";

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-background", compact && "border-l border-border shadow-2xl")}>
      {compact && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Assistant
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {getAssistantContextLabel(context)}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto w-full px-3 py-4", compact ? "max-w-full" : "container max-w-4xl sm:px-4 sm:py-6")}>
          {!hasConversation && (
            <div className={cn("flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500", compact ? "min-h-[38vh] space-y-4" : "min-h-[36vh] space-y-6 px-2")}>
              <div className="rounded-full bg-primary/10 p-3 sm:p-4">
                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <h1 className={cn("font-semibold tracking-tight", compact ? "text-lg" : "text-2xl sm:text-3xl")}>
                  {mode === "reflect" ? "Reflect on this source" : "Ask Your Knowledge Base"}
                </h1>
                <p className={cn("text-muted-foreground mx-auto", compact ? "max-w-xs text-xs" : "max-w-md text-sm sm:text-base px-4")}>
                  {mode === "reflect"
                    ? "Synthesize highlights, notes, and takeaways from this source"
                    : "Get instant answers from your citations and notes using AI-powered semantic search"}
                </p>
              </div>
            </div>
          )}

          {hasConversation && (
            <div className={cn("space-y-4 sm:space-y-6", compact ? "pb-4" : "py-2 sm:py-4")}>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={reset} className="h-8 text-xs text-muted-foreground">
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear Chat
                </Button>
              </div>

              {items.map((item) => {
                if (item.kind === "user_message") {
                  return <UserMessage key={item.id} question={item.text} />;
                }
                if (item.kind === "tool_call") {
                  return <ToolCallItem key={item.id} item={item} />;
                }
                if (item.kind === "reasoning") {
                  return (
                    <ReasoningPanel
                      key={item.id}
                      text={item.text}
                      streaming={item.streaming}
                      durationMs={item.durationMs}
                      className="ml-1"
                    />
                  );
                }
                if (item.kind === "assistant_suggestion") {
                  return <AssistantSuggestionCard key={item.id} suggestion={item.suggestion} />;
                }
                if (item.kind === "streaming_answer") {
                  return (
                    <AssistantMessage
                      key={item.id}
                      response={{ answer: item.text, citations: item.citations }}
                      isStreaming
                    />
                  );
                }
                if (item.kind === "assistant_message") {
                  return (
                    <div key={item.id} className="space-y-3">
                      <AssistantMessage
                        response={{ answer: item.text, citations: item.citations }}
                      />
                      {item.followups && item.followups.length > 0 && (
                        <div className="ml-0 flex flex-wrap gap-2 sm:ml-12">
                          {item.followups.map((followup) => (
                            <Button
                              key={followup}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto min-h-8 rounded-full px-3 py-1.5 text-xs"
                              onClick={() => submitQuestion(followup)}
                              disabled={isLoading}
                            >
                              {followup}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}

              {isLoading &&
                !hasToolCalls &&
                !hasStreamingReasoning &&
                !items.some((item) => item.kind === "streaming_answer") && (
                  <div className="ml-12 text-xs">
                    <ShimmerLabel>Thinking</ShimmerLabel>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      <div className={cn("bg-background/95 p-3 backdrop-blur-sm", !compact && "px-4")}>
        <div className={cn("mx-auto", compact ? "max-w-full" : "container max-w-3xl")}>
          <AskInput
            value={question}
            onChange={setQuestion}
            onSubmit={handleSubmit}
            onCancel={cancel}
            isLoading={isLoading}
            models={models}
            isModelReady={isModelReady}
            modelId={modelId}
            onModelChange={setModel}
            reasoningLevel={reasoningLevel}
            onReasoningLevelChange={setReasoningLevel}
          />
          {error && (
            <div className="mt-2 text-xs sm:text-sm text-destructive bg-destructive/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
              {error.message}
            </div>
          )}
          {modelCatalogError && (
            <div className="mt-2 rounded-full bg-destructive/10 px-3 py-1.5 text-xs text-destructive sm:px-4 sm:py-2 sm:text-sm">
              Models are temporarily unavailable. Refresh the page to try again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
