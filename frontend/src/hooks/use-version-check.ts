import { useEffect, useState } from "react";

type Options = {
  intervalMs?: number;
  endpoint?: string;
};

export function useVersionCheck({
  intervalMs = 5 * 60 * 1000,
  // Static asset emitted by the Vite build (see versionJson() in vite.config.ts).
  endpoint = "/version.json",
}: Options = {}) {
  const [, setCurrentVersion] = useState<string | null>(
    import.meta.env.VITE_RELEASE ?? null
  );
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // No version.json in dev (the plugin only emits it at build), and the dev
    // server returns index.html for unknown paths — so checking is pointless and
    // can produce false "update available" prompts. Only run in production.
    if (!import.meta.env.PROD) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        const nextVersion = data?.version as string | undefined;

        if (cancelled || !nextVersion) return;

        // First successful check establishes baseline so we don't
        // incorrectly show stale on initial load when env is empty.
        setCurrentVersion((existing) => {
          if (!existing) {
            return nextVersion;
          }

          if (nextVersion !== existing) {
            setStale(true);
          }

          return existing;
        });
      } catch (error) {
        console.error("Version check failed", error);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };

    check();
    if (intervalMs > 0) {
      timer = setInterval(check, intervalMs);
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [endpoint, intervalMs]);

  return stale;
}
