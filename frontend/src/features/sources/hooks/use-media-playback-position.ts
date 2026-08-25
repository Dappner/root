import { useCallback, useEffect, useRef } from "react";
import { updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut } from "@/features/rag/rag-api.generated";
import type { SourceDTO } from "@/features/sources/types";

interface UseMediaPlaybackPositionOptions {
  source: SourceDTO | null | undefined;
  enabled?: boolean;
  saveInterval?: number;
}

export function useMediaPlaybackPosition({
  source,
  enabled = true,
  saveInterval = 10,
}: UseMediaPlaybackPositionOptions) {
  const lastSavedPositionRef = useRef<number>(0);
  const lastSavedTimeRef = useRef<number>(0);
  const currentPositionRef = useRef<number>(0);
  const currentDurationRef = useRef<number>(0);
  const enabledRef = useRef(enabled);
  const sourceRef = useRef(source);

  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const performSave = useCallback(
    (position: number, duration: number) => {
      if (!enabled || !source) return;
      updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut(source.id, {
        position_seconds: position,
        duration_seconds: duration > 0 ? duration : undefined,
        is_playing: true,
      });
      lastSavedPositionRef.current = position;
      lastSavedTimeRef.current = Date.now();
    },
    [enabled, source],
  );

  const savePosition = useCallback(
    (position: number, duration: number) => {
      if (!enabled || !source) return;
      currentPositionRef.current = position;
      currentDurationRef.current = duration;

      const timeSinceLastSave = (Date.now() - lastSavedTimeRef.current) / 1000;
      const positionDiff = Math.abs(position - lastSavedPositionRef.current);

      if (timeSinceLastSave >= saveInterval || positionDiff >= 30) {
        performSave(position, duration);
      }
    },
    [enabled, source, saveInterval, performSave],
  );

  // Save on unmount
  useEffect(() => {
    return () => {
      if (!enabledRef.current) return;
      const position = currentPositionRef.current;
      const duration = currentDurationRef.current;
      const src = sourceRef.current;
      if (position > 0 && src) {
        updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut(src.id, {
          position_seconds: position,
          duration_seconds: duration > 0 ? duration : undefined,
          is_playing: false,
        });
      }
    };

  }, []);

  const getSavedPosition = useCallback((): number => {
    if (!source?.metadata) return 0;
    let metadata: Record<string, unknown> = {};
    if (typeof source.metadata === "string") {
      try { metadata = JSON.parse(source.metadata); } catch { return 0; }
    } else if (typeof source.metadata === "object") {
      metadata = source.metadata as Record<string, unknown>;
    }
    const position = metadata.current_position;
    return typeof position === "number" ? position : 0;
  }, [source]);

  return {
    savePosition,
    savedPosition: getSavedPosition(),
  };
}
