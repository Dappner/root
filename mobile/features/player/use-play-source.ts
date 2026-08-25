import { useCallback } from "react";
import { useRouter } from "expo-router";
import { getSourcePlaybackPosition } from "@/lib/utils";
import type { SourceDTO } from "@/features/sources/api";
import { usePlayer, readLocalTranscript } from "./context";

export function usePlaySource() {
  const { play } = usePlayer();
  const router = useRouter();

  return useCallback((source: SourceDTO) => {
    if (!source.episode_id) return;
    const transcript = readLocalTranscript(source.id);
    const posSec = getSourcePlaybackPosition(source.metadata).posSec;
    // Open the player immediately; let audio load in the background so the UI
    // doesn't wait on the stream/MP3 buffering. The player surfaces its own
    // loading state via `isLoading`.
    router.navigate("/player");
    void play(
      {
        episode: {
          id: source.episode_id,
          title: source.title,
          image_url: source.image_url,
          enclosure_url: source.media_url ?? undefined,
          duration: source.duration,
          episode_guid: "",
          transcript_status: "none",
          created_at: source.created_at,
          updated_at: source.updated_at,
        },
        source,
        transcript,
      },
      posSec > 0 ? posSec : undefined
    );
  }, [play, router]);
}
