import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import type { DownloadQuality } from "./utils";

const WIFI_PREF_KEY = "root.settings.autoDownloadWifi";
const QUALITY_PREF_KEY = "root.settings.downloadQuality";

function isDownloadQuality(value: string | null): value is DownloadQuality {
  return value === "standard" || value === "balanced" || value === "best";
}

export function useDownloadPreferences() {
  const [autoDownloadWifi, setAutoDownloadWifi] = useState(true);
  const [downloadQuality, setDownloadQuality] = useState<DownloadQuality>("balanced");

  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      const [wifi, quality] = await Promise.all([
        SecureStore.getItemAsync(WIFI_PREF_KEY),
        SecureStore.getItemAsync(QUALITY_PREF_KEY),
      ]);
      if (cancelled) return;
      if (wifi != null) setAutoDownloadWifi(wifi === "true");
      if (isDownloadQuality(quality)) setDownloadQuality(quality);
    }

    void loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  const setWifiPreference = useCallback((value: boolean) => {
    setAutoDownloadWifi(value);
    void SecureStore.setItemAsync(WIFI_PREF_KEY, String(value));
  }, []);

  const setQualityPreference = useCallback((value: DownloadQuality) => {
    setDownloadQuality(value);
    void SecureStore.setItemAsync(QUALITY_PREF_KEY, value);
  }, []);

  return {
    autoDownloadWifi,
    downloadQuality,
    setWifiPreference,
    setQualityPreference,
  };
}
