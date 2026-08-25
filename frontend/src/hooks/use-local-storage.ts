"use client";

import * as React from "react";

const LOCAL_STORAGE_EVENT = "use-local-storage:change";

type LocalStorageChangeDetail = {
  key: string;
  value: unknown;
};

/**
 * Generic hook for persisting state to localStorage with type safety.
 *
 * @param key - The localStorage key
 * @param initialValue - Default value if nothing is stored
 * @returns [value, setValue] tuple like useState
 *
 * @example
 * const [showDetails, setShowDetails] = useLocalStorage('citation-show-details', false);
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Keep refs to the latest value/initialValue so event listeners can read them
  // without resubscribing on every render.
  const storedValueRef = React.useRef(storedValue);
  storedValueRef.current = storedValue;

  const initialValueRef = React.useRef(initialValue);
  initialValueRef.current = initialValue;

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<LocalStorageChangeDetail>).detail;
      if (!detail || detail.key !== key) return;
      setStoredValue(detail.value as T);
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== window.localStorage) return;
      if (event.newValue === null) {
        setStoredValue(initialValueRef.current);
        return;
      }
      try {
        setStoredValue(JSON.parse(event.newValue) as T);
      } catch (error) {
        console.warn(`Error parsing storage event for key "${key}":`, error);
      }
    };

    window.addEventListener(LOCAL_STORAGE_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);
    return () => {
      window.removeEventListener(LOCAL_STORAGE_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [key]);

  const setValue = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValueRef.current) : value;

        setStoredValue(valueToStore);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          window.dispatchEvent(
            new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_EVENT, {
              detail: { key, value: valueToStore },
            }),
          );
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

/**
 * Predefined localStorage keys for the app.
 * Centralize key definitions to avoid typos and enable refactoring.
 */
export const LOCAL_STORAGE_KEYS = {
  CITATION_SHOW_OPTIONAL_FIELDS: "citation-show-optional-fields",
  CAPTURE_SHOW_OPTIONAL_FIELDS: "capture-show-optional-fields",
  SOURCES_HIDE_FINISHED: "sources-hide-finished",
  SOURCES_HIDE_IN_COLLECTIONS: "sources-hide-in-collections",
  COLLECTION_SORT: "collection-sort",
  COMMAND_PALETTE_GLOBAL_SHORTCUT_MODE: "command-palette-global-shortcut-mode",
  DASHBOARD_MODE: "dashboard-mode",
  NOTES_VIEW_MODE: "notes-view-mode",
  NOTES_SORT: "notes-sort",
} as const;
