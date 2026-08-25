import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import type { SourceDTO } from "../api";
import { useOfflineStore } from "@/features/offline";

export type DownloadStatus = "idle" | "checking" | "downloading" | "done" | "error";

export function useSourceDownload(source: SourceDTO | undefined | null) {
  const offline = useOfflineStore();
  const [status, setStatus] = useState<DownloadStatus>("checking");

  useEffect(() => {
    if (source?.id) {
      setStatus(offline.isSourceDownloaded(source.id) ? "done" : "idle");
    }
  }, [source?.id, offline, offline.version]);

  const download = useCallback(async () => {
    if (!source?.episode_id || !source) return;
    setStatus("downloading");
    try {
      await offline.downloadSource({ source });
      setStatus("done");
      Alert.alert("Downloaded", "Episode saved to your device.");
    } catch {
      setStatus("error");
      Alert.alert("Download failed", "Could not download this episode.");
    }
  }, [source, offline]);

  return { status, download };
}
