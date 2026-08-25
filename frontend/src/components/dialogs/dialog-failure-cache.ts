const ENABLE_DIALOG_FAILURE_CACHE = false;
const CACHE_PREFIX = "dialog-failure:";

function getStorageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function readDialogFailureCache<T>(key: string): T | null {
  if (!ENABLE_DIALOG_FAILURE_CACHE || typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.warn("Failed to read dialog failure cache:", error);
    return null;
  }
}

export function writeDialogFailureCache<T>(key: string, values: T): void {
  if (!ENABLE_DIALOG_FAILURE_CACHE || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(values));
  } catch (error) {
    console.warn("Failed to write dialog failure cache:", error);
  }
}

export function clearDialogFailureCache(key: string): void {
  if (!ENABLE_DIALOG_FAILURE_CACHE || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(key));
  } catch (error) {
    console.warn("Failed to clear dialog failure cache:", error);
  }
}

export function isDialogFailureCacheEnabled(): boolean {
  return ENABLE_DIALOG_FAILURE_CACHE;
}
