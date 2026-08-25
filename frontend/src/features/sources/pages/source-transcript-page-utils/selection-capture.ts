import type { CitationLocation } from "@/features/sources/utils/location";

/**
 * Result of capturing a transcript selection.
 */
export interface SelectionCapture {
  /** The cleaned selected text */
  text: string;
  /** Multi-anchor location data for robust highlighting */
  location: CitationLocation;
}

/**
 * Data attributes expected on utterance span elements.
 */
interface UtteranceElement extends HTMLElement {
  dataset: {
    utteranceIdx: string;
    startTime: string;
    endTime: string;
  };
}

/**
 * Cleans selected text by removing timestamp patterns and normalizing whitespace.
 */
function cleanSelectedText(text: string): string {
  return (
    text
      // Remove standalone timestamps like "1:37" or "12:05:30"
      .replace(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?:\s|$)/g, " ")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Walks up the DOM tree to find an ancestor element with utterance data attributes.
 */
function findAncestorWithUtteranceData(
  node: Node | null,
): UtteranceElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.dataset.utteranceIdx !== undefined
    ) {
      return current as UtteranceElement;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Gets the character offset of a selection anchor within its utterance element.
 * This handles the case where the selection might be in a nested text node.
 */
function getCharOffsetInElement(
  node: Node | null,
  offset: number,
  utteranceElement: HTMLElement,
): number {
  if (!node) return 0;

  // If the node is the element itself, offset is child index
  if (node === utteranceElement) {
    // Sum up text content of all children before this offset
    let charOffset = 0;
    for (let i = 0; i < offset && i < utteranceElement.childNodes.length; i++) {
      charOffset += utteranceElement.childNodes[i].textContent?.length ?? 0;
    }
    return charOffset;
  }

  // Walk through children to find the node and calculate offset
  let charOffset = 0;
  const walker = document.createTreeWalker(
    utteranceElement,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let textNode = walker.nextNode();
  while (textNode) {
    if (textNode === node) {
      return charOffset + offset;
    }
    charOffset += textNode.textContent?.length ?? 0;
    textNode = walker.nextNode();
  }

  // Fallback: return the offset directly
  return offset;
}


/**
 * Ensures start element comes before end element in the DOM.
 * Swaps indx in the case where user selects backwards (right-to-left).
 */
function normalizeSelectionOrder(
  anchorEl: UtteranceElement,
  focusEl: UtteranceElement,
): { startEl: UtteranceElement; endEl: UtteranceElement } {
  const anchorIdx = parseInt(anchorEl.dataset.utteranceIdx, 10);
  const focusIdx = parseInt(focusEl.dataset.utteranceIdx, 10);

  // If anchor comes after focus, swap them
  if (anchorIdx > focusIdx) {
    return { startEl: focusEl, endEl: anchorEl };
  }

  return { startEl: anchorEl, endEl: focusEl };
}

/**
 * Captures the current text selection with full multi-anchor location data.
 *
 * Reads utterance metadata directly from DOM data attributes, ensuring
 * 100% reliable timestamp and position extraction.
 *
 * @returns SelectionCapture with text and location, or null if no valid selection
 */
export function captureTranscriptSelection(): SelectionCapture | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  // Find utterance elements for anchor and focus
  const anchorEl = findAncestorWithUtteranceData(selection.anchorNode);
  const focusEl = findAncestorWithUtteranceData(selection.focusNode);

  if (!anchorEl || !focusEl) {
    // Selection is outside transcript utterances
    return null;
  }

  // Normalize selection direction (handle backwards selection)
  const { startEl, endEl } = normalizeSelectionOrder(anchorEl, focusEl);

  // Get selected text and clean it
  const rawText = selection.toString();
  const cleanedText = cleanSelectedText(rawText);

  if (!cleanedText) {
    return null;
  }

  // Extract all anchor data
  const utteranceStartIdx = parseInt(startEl.dataset.utteranceIdx, 10);
  const utteranceEndIdx = parseInt(endEl.dataset.utteranceIdx, 10);
  const tStartSec = parseFloat(startEl.dataset.startTime);
  const tEndSec = parseFloat(endEl.dataset.endTime);

  // Calculate character offsets within utterances
  const charOffsetStart = getCharOffsetInElement(
    range.startContainer,
    range.startOffset,
    startEl,
  );
  const charOffsetEnd = getCharOffsetInElement(
    range.endContainer,
    range.endOffset,
    endEl,
  );

  return {
    text: cleanedText,
    location: {
      mode: "derived",
      type: "transcript_v1",
      transcript: {
        tStartSec,
        tEndSec,
        utteranceStartIdx,
        utteranceEndIdx,
        charOffsetStart,
        charOffsetEnd,
      },
    },
  };
}

/**
 * Checks if there is a valid transcript selection that can be captured.
 */
export function hasTranscriptSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  const anchorEl = findAncestorWithUtteranceData(selection.anchorNode);
  const focusEl = findAncestorWithUtteranceData(selection.focusNode);

  return anchorEl !== null && focusEl !== null;
}
