"use client";

import { Button } from "@/components/ui/button";
import { NoSSR } from "@/components/no-ssr";
import {
  ModelSelector,
  ReasoningLevelSelector,
  type ReasoningLevel,
} from "@/features/rag/components/model-selector";
import { SourceSuggestion } from "@/features/rag/components/source-suggestion";
import { useSources } from "@/features/sources/hooks/sources";
import { VoiceTranscriptionButton } from "@/features/voice/components/voice-transcription-button";
import { WaveformCanvas } from "@/features/voice/components/waveform-canvas";
import type { SourceDTO, SourceType } from "@/features/sources/types";
import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MentionsInput, Mention } from "react-mentions";
import type { AvailableModel, AvailableModelId } from "../types";

interface AskInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  models: AvailableModel[];
  isModelReady: boolean;
  modelId: AvailableModelId;
  onModelChange: (modelId: AvailableModelId) => void;
  reasoningLevel: ReasoningLevel;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
}

export function AskInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  isLoading = false,
  disabled = false,
  models,
  isModelReady,
  modelId,
  onModelChange,
  reasoningLevel,
  onReasoningLevelChange,
}: AskInputProps) {
  const { data: sourcesList } = useSources();
  const sources = sourcesList?.sources || [];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [recordingAnalyser, setRecordingAnalyser] = useState<AnalyserNode | null>(null);
  const selectedModel = models.find((model) => model.id === modelId);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPortalHost(document.body);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Auto-focus the input when component mounts or becomes enabled
    if (!disabled && !isLoading) {
      // Small delay to ensure DOM is ready and page is visible
      const timeoutId = setTimeout(() => {
        if (inputRef.current && document.visibilityState === "visible") {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [disabled, isLoading]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <div className="relative group">
        {recordingAnalyser && (
          <WaveformCanvas
            analyser={recordingAnalyser}
            className="pointer-events-none absolute inset-0 z-10 h-full w-full text-foreground"
          />
        )}
        <NoSSR
          fallback={
            <div className="min-h-[52px] w-full rounded-xl border border-border bg-background px-3 py-3 text-sm sm:text-base text-muted-foreground shadow-sm">
              Ask anything...
            </div>
          }
        >
          <MentionsInput
            inputRef={inputRef}
            value={value}
            onChange={(e, newValue) => {
              onChange(newValue);
            }}
            placeholder="Ask anything..."
            className="mentions-input min-h-[52px] max-h-56 overflow-y-auto pl-3 sm:pl-4 pr-20 sm:pr-24 py-3 text-sm sm:text-base resize-none rounded-xl bg-background border border-border shadow-sm focus-within:border-primary/50 transition-all"
            disabled={disabled || isLoading}
            allowSuggestionsAboveCursor
            allowSpaceInQuery
            suggestionsPortalHost={portalHost ?? undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.isDefaultPrevented()) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            style={{
              control: {
                maxHeight: "14rem",
              },
              highlighter: {
                maxHeight: "14rem",
                paddingRight: "6.5rem",
              },
              input: {
                maxHeight: "14rem",
                paddingRight: "6.5rem",
              },
              suggestions: {
                list: {
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  maxWidth: "400px",
                },
                item: {
                  borderBottom: "1px solid var(--border)",
                  "&focused": {
                    backgroundColor: "var(--accent)",
                  },
                },
              },
            }}
          >
            <Mention
              trigger="@"
              data={(search, callback) => {
                const filtered = sources
                  .filter((s) =>
                    s.title?.toLowerCase().includes(search.toLowerCase())
                  )
                  .slice(0, 10)
                  .map((s: SourceDTO) => ({
                    id: s.id,
                    display: s.title ?? "Untitled Source",
                    type: s.type as SourceType,
                    author: s.author,
                  }));
                callback(filtered);
              }}
              markup="@[__display__](__id__)"
              regex={/@\[([^\]]+)\]\((\d+)\)/}
              displayTransform={(id, display) => `@${display}`}
              renderSuggestion={(
                entry,
                search,
                highlightedDisplay,
                index,
                focused
              ) => (
                <SourceSuggestion
                  entry={entry}
                  search={search}
                  highlightedDisplay={highlightedDisplay}
                  index={index}
                  focused={focused}
                />
              )}
            />
          </MentionsInput>
        </NoSSR>
        <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 flex gap-1">
          <VoiceTranscriptionButton
            disabled={disabled || isLoading}
            className="h-7 w-7 sm:h-8 sm:w-8"
            tooltip="Dictate question"
            onTranscript={(transcript) => {
              const separator = value.trim() ? " " : "";
              onChange(`${value}${separator}${transcript}`);
              inputRef.current?.focus();
            }}
            onRecordingStateChange={(_state, analyser) => setRecordingAnalyser(analyser)}
          />
          {isLoading && onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          )}
          <Button
            type="submit"
            disabled={isLoading || !value.trim() || !isModelReady}
            size="icon"
            className="size-7 sm:size-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-none shadow-none transition-all disabled:bg-muted disabled:text-muted-foreground"
          >
            <Send className="size-3.5 sm:size-4" />
          </Button>
        </div>
      </div>
      <div className="flex gap-2 px-1">
        <ModelSelector
          models={models}
          value={modelId}
          onChange={onModelChange}
          disabled={isLoading || !isModelReady}
        />
        <ReasoningLevelSelector
          model={selectedModel}
          value={reasoningLevel}
          onChange={onReasoningLevelChange}
          disabled={isLoading || !isModelReady}
        />
      </div>
    </form>
  );
}
