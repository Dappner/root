import type {
  AnthropicReasoningEffort,
  AvailableModel,
  GeminiThinkingLevel,
  ModelConfig,
  OpenAIReasoningEffort,
  ReasoningLevel,
} from "@/features/rag/types";
import type { RootAssistantContext } from "./types";

export function transformAssistantMessage(message: string) {
  return message.replace(/@\[([^\]]+)\]\((\d+)\)/g, "<source-id:$2>");
}

export function buildModelConfig(
  selectedModel: AvailableModel,
  reasoningLevel: ReasoningLevel,
): ModelConfig {
  const config: ModelConfig = {
    provider: selectedModel.provider,
    model: selectedModel.id,
  };

  if (reasoningLevel && selectedModel.reasoning?.parameter === "thinking_level") {
    config.thinking_level = reasoningLevel as GeminiThinkingLevel;
  } else if (reasoningLevel && selectedModel.reasoning?.parameter === "reasoning_effort") {
    config.reasoning_effort = reasoningLevel as
      | OpenAIReasoningEffort
      | AnthropicReasoningEffort;
  }

  return config;
}

export function getAssistantContextLabel(context: RootAssistantContext) {
  if (context.surface === "section") return "Current section";
  if (context.surface === "source") return "Current source";
  if (context.surface === "ask" || context.surface === "library") return "Library";
  return context.surface.charAt(0).toUpperCase() + context.surface.slice(1);
}
