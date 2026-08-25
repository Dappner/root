"use client";

import { AssistantSurface } from "@/features/assistant/components/assistant-surface";

interface SourceReflectPageProps {
  sourceId: number;
  contained?: boolean;
}

export function SourceReflectPage({ sourceId, contained = false }: SourceReflectPageProps) {
  return (
    <div className={contained ? "h-full" : "h-[calc(100vh-7rem)] min-h-[560px]"}>
      <AssistantSurface
        context={{ surface: "source", source_id: sourceId }}
        variant={contained ? "panel" : "page"}
        mode="reflect"
      />
    </div>
  );
}
