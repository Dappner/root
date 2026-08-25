import { useEffect } from "react";

interface KeyboardShortcutOptions {
  key?: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  caseSensitive?: boolean;
}

/**
 * Generic hook for keyboard shortcuts with automatic input element filtering
 *
 * @param callback - Function to execute when shortcut is triggered
 * @param options - Shortcut configuration
 *
 * @example
 * // Play/pause with Space key
 * useKeyboardShortcut(() => togglePlay(), { code: "Space" });
 *
 * @example
 * // Submit with Cmd/Ctrl+Enter
 * useKeyboardShortcut(() => handleSubmit(), {
 *   key: "Enter",
 *   metaKey: true
 * });
 */
export function useKeyboardShortcut(
  callback: () => void,
  options: KeyboardShortcutOptions
) {
  const {
    key,
    code,
    metaKey = false,
    ctrlKey = false,
    shiftKey = false,
    altKey = false,
    preventDefault = true,
    enabled = true,
    caseSensitive = false,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if modifier keys don't match
      if (metaKey && !e.metaKey) return;
      if (ctrlKey && !e.ctrlKey) return;
      if (shiftKey && !e.shiftKey) return;
      if (altKey && !e.altKey) return;

      // If no modifiers are expected, ensure none are pressed (except shift for letter case)
      if (!metaKey && !ctrlKey && !shiftKey && !altKey) {
        // Block if CMD/Ctrl/Alt are pressed (but allow Shift for uppercase letters)
        if (e.metaKey || e.ctrlKey || e.altKey) return;
      }

      // Skip if key doesn't match
      if (key) {
        const eventKey = caseSensitive ? e.key : e.key.toLowerCase();
        const expectedKey = caseSensitive ? key : key.toLowerCase();
        if (eventKey !== expectedKey) return;
      }
      if (code && e.code !== code) return;

      // Skip if user is typing in an input element
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInput) return;

      if (preventDefault) {
        e.preventDefault();
      }

      callback();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    callback,
    key,
    code,
    metaKey,
    ctrlKey,
    shiftKey,
    altKey,
    preventDefault,
    enabled,
    caseSensitive,
  ]);
}
