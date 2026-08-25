"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useModelCatalog } from "@/features/rag/hooks";
import { useRagStore } from "@/features/rag/store";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Gauge, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AvailableModel,
  AvailableModelId,
  ReasoningLevel as RagReasoningLevel,
} from "../types";

export type ReasoningLevel = RagReasoningLevel;

const PROVIDERS = [
  { id: "gemini", label: "Google" },
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
] as const;

const TIER_LABELS = {
  fast: "Fast",
  balanced: "Balanced",
  powerful: "Powerful",
} as const;

function TierIcon({ tier }: { tier: AvailableModel["tier"] }) {
  if (tier === "fast") return <Zap className="size-4 text-amber-500" />;
  if (tier === "balanced") return <Gauge className="size-4 text-sky-500" />;
  return <Sparkles className="size-4 text-violet-500" />;
}

interface ModelSelectorProps {
  models: AvailableModel[];
  value: AvailableModelId;
  onChange: (value: AvailableModelId) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, value, onChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedModel = models.find((model) => model.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50",
        )}
      >
        {selectedModel ? <TierIcon tier={selectedModel.tier} /> : <Gauge className="size-3.5" />}
        <span className="hidden max-w-40 truncate sm:inline">
          {selectedModel?.label ?? (models.length ? "Choose model" : "Loading models")}
        </span>
        <ChevronDown className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),24rem)] overflow-hidden p-0"
        align="start"
      >
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium">Choose a model</p>
          <p className="text-xs text-muted-foreground">
            Fast for quick answers, powerful for deeper synthesis.
          </p>
        </div>
        <div className="max-h-[min(32rem,70vh)] overflow-y-auto p-1.5">
          {PROVIDERS.map((provider) => {
            const providerModels = models.filter((model) => model.provider === provider.id);
            if (!providerModels.length) return null;

            return (
              <div key={provider.id} className="pb-1.5 last:pb-0">
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {provider.label}
                </div>
                {providerModels.map((model) => {
                  const isSelected = model.id === value;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onChange(model.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent",
                        isSelected && "bg-accent",
                      )}
                    >
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                        <TierIcon tier={model.tier} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{model.label}</span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                            {TIER_LABELS[model.tier]}
                          </span>
                          {model.recommended && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {model.description}
                        </p>
                      </div>
                      {isSelected && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ReasoningLevelSelectorProps {
  model?: AvailableModel;
  value: ReasoningLevel;
  onChange: (value: ReasoningLevel) => void;
  disabled?: boolean;
}

export function ReasoningLevelSelector({
  model,
  value,
  onChange,
  disabled,
}: ReasoningLevelSelectorProps) {
  const [open, setOpen] = useState(false);
  const options = model?.reasoning?.options ?? [];

  if (!options.length) return null;

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50",
        )}
      >
        <span className="hidden sm:inline">Reasoning: {selectedOption?.label ?? "Default"}</span>
        <ChevronDown className="size-3 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="space-y-0.5">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
                  isSelected && "bg-accent",
                )}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
                {isSelected && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function isReasoningLevelValid(model: AvailableModel, level: ReasoningLevel) {
  if (!model.reasoning) return level === null;
  return model.reasoning.options.some((option) => option.value === level);
}

/** Manage the persisted preference while reconciling it against the backend catalog. */
export function useModelSelection() {
  const { data: catalog, isSuccess, error } = useModelCatalog();
  const {
    modelId: persistedModelId,
    reasoningLevel: persistedReasoningLevel,
    setModel: setPersistedModel,
    setReasoningLevel,
  } = useRagStore();

  const models = catalog?.models ?? [];
  const selectedModel =
    models.find((model) => model.id === persistedModelId) ??
    models.find((model) => model.id === catalog?.default_model);
  const reasoningLevel = selectedModel
    ? isReasoningLevelValid(selectedModel, persistedReasoningLevel)
      ? persistedReasoningLevel
      : (selectedModel.reasoning?.default ?? null)
    : null;

  useEffect(() => {
    if (!selectedModel) return;
    if (
      persistedModelId !== selectedModel.id ||
      persistedReasoningLevel !== reasoningLevel
    ) {
      setPersistedModel(selectedModel.id, reasoningLevel);
    }
  }, [
    persistedModelId,
    persistedReasoningLevel,
    reasoningLevel,
    selectedModel,
    setPersistedModel,
  ]);

  const setModel = (id: AvailableModelId) => {
    const model = models.find((candidate) => candidate.id === id);
    if (model) setPersistedModel(id, model.reasoning?.default ?? null);
  };

  return {
    models,
    modelId: selectedModel?.id ?? persistedModelId,
    setModel,
    selectedModel,
    reasoningLevel,
    setReasoningLevel,
    isModelReady: isSuccess && Boolean(selectedModel),
    modelCatalogError: error,
  };
}
