"use client";

import { Debouncer } from "@tanstack/react-pacer/debouncer";
import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

interface UseAutosaveDraftOptions<TDraft, TPayload, TResult> {
  draft: TDraft;
  isDirty?: boolean;
  isEqual?: (a: TDraft, b: TDraft) => boolean;
  enabled?: boolean;
  debounceMs?: number;
  minSavingMs?: number;
  toPayload: (draft: TDraft) => TPayload | null;
  save: (payload: TPayload) => Promise<TResult>;
  validate?: (payload: TPayload) => boolean;
  onSaved?: (result: TResult, payload: TPayload) => void;
  onError?: (error: unknown) => void;
}

interface UseAutosaveDraftResult {
  saveState: AutosaveState;
  isDirty: boolean;
  flushNow: () => Promise<void>;
}

export function useAutosaveDraft<TDraft, TPayload, TResult>({
  draft,
  isDirty: externalDirty,
  isEqual,
  enabled = true,
  debounceMs = 1200,
  minSavingMs = 350,
  toPayload,
  save,
  validate,
  onSaved,
  onError,
}: UseAutosaveDraftOptions<TDraft, TPayload, TResult>): UseAutosaveDraftResult {
  const [saveState, setSaveState] = useState<AutosaveState>("idle");
  const [internalDirty, setInternalDirty] = useState(false);

  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const lastSavedDraftRef = useRef(draft);
  const prevEnabledRef = useRef(enabled);

  const toPayloadRef = useRef(toPayload);
  const saveRef = useRef(save);
  const validateRef = useRef(validate);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  const debouncerRef = useRef<any>(null);
  const inFlightRef = useRef(false);
  const queuedPayloadRef = useRef<TPayload | null>(null);
  const activeSaveRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      debouncerRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    toPayloadRef.current = toPayload;
  }, [toPayload]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    validateRef.current = validate;
  }, [validate]);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (enabled && !prevEnabledRef.current && typeof externalDirty !== "boolean") {
      lastSavedDraftRef.current = draftRef.current;
      dirtyRef.current = false;
      setInternalDirty(false);
    }
    prevEnabledRef.current = enabled;
  }, [enabled, externalDirty]);

  useEffect(() => {
    if (typeof externalDirty === "boolean") {
      dirtyRef.current = externalDirty;
      return;
    }

    const equal = isEqual
      ? isEqual(draft, lastSavedDraftRef.current)
      : Object.is(draft, lastSavedDraftRef.current);
    const nextDirty = !equal;
    dirtyRef.current = nextDirty;
    setInternalDirty(nextDirty);
  }, [draft, externalDirty, isEqual]);

  const runSave = useCallback(async (payload: TPayload): Promise<void> => {
    const startedAt = Date.now();
    if (mountedRef.current) setSaveState("saving");

    try {
      const result = await saveRef.current(payload);
      lastSavedDraftRef.current = draftRef.current;
      if (typeof externalDirty !== "boolean") {
        dirtyRef.current = false;
        setInternalDirty(false);
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < minSavingMs) {
        await new Promise((resolve) => setTimeout(resolve, minSavingMs - elapsed));
      }
      if (mountedRef.current) setSaveState("saved");
      onSavedRef.current?.(result, payload);
    } catch (error) {
      if (mountedRef.current) setSaveState("error");
      onErrorRef.current?.(error);
    }
  }, [externalDirty, minSavingMs]);

  const drainSaveQueue = useCallback((): Promise<void> => {
    if (inFlightRef.current && activeSaveRef.current) {
      return activeSaveRef.current;
    }

    const execute = async () => {
      while (queuedPayloadRef.current) {
        const nextPayload = queuedPayloadRef.current;
        queuedPayloadRef.current = null;
        if (!nextPayload) continue;
        inFlightRef.current = true;
        await runSave(nextPayload);
      }
      inFlightRef.current = false;
    };

    const promise = execute().finally(() => {
      inFlightRef.current = false;
      activeSaveRef.current = null;
    });

    activeSaveRef.current = promise;
    return promise;
  }, [runSave]);

  const queueSave = useCallback(
    (payload: TPayload): Promise<void> => {
      queuedPayloadRef.current = payload;
      return drainSaveQueue();
    },
    [drainSaveQueue]
  );

  useEffect(() => {
    const debouncer = new Debouncer(
      (payload: TPayload) => {
        void queueSave(payload);
      },
      { wait: debounceMs }
    );

    debouncerRef.current = debouncer;
    return () => {
      debouncer.cancel();
      if (debouncerRef.current === debouncer) {
        debouncerRef.current = null;
      }
    };
  }, [debounceMs, queueSave]);

  const flushNow = useCallback(async (): Promise<void> => {
    if (!enabledRef.current || !dirtyRef.current) return;

    const payload = toPayloadRef.current(draftRef.current);
    if (!payload) return;
    if (validateRef.current && !validateRef.current(payload)) return;

    debouncerRef.current?.cancel?.();
    await queueSave(payload);
  }, [queueSave]);

  useEffect(() => {
    const shouldSave = typeof externalDirty === "boolean" ? externalDirty : internalDirty;
    if (!enabled || !shouldSave) return;

    const payload = toPayloadRef.current(draftRef.current);
    if (!payload) return;
    if (validateRef.current && !validateRef.current(payload)) return;

    debouncerRef.current?.maybeExecute?.(payload);
  }, [debounceMs, draft, enabled, externalDirty, internalDirty]);

  useEffect(() => {
    const triggerFlush = () => {
      void flushNow();
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      const current = window.location;
      const samePath =
        nextUrl.pathname === current.pathname && nextUrl.search === current.search;
      if (nextUrl.origin === current.origin && !samePath) {
        triggerFlush();
      }
    };

    const handlePopState = () => {
      triggerFlush();
    };

    const handlePageHide = () => {
      triggerFlush();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerFlush();
      }
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      void flushNow();
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushNow]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => {
      if (mountedRef.current) setSaveState("idle");
    }, 1500);
    return () => clearTimeout(timer);
  }, [saveState]);

  return {
    saveState,
    isDirty: typeof externalDirty === "boolean" ? externalDirty : internalDirty,
    flushNow,
  };
}
