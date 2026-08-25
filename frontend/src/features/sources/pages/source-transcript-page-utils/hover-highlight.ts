"use client";

const HOVER_CLASS = "citation-hover";

export function setCitationHover(citationId: number, isActive: boolean) {
  if (citationId === null || citationId === undefined) return;

  const elements = document.querySelectorAll(`[data-citation-id="${citationId}"]`);
  elements.forEach((el) => {
    if (isActive) {
      el.classList.add(HOVER_CLASS);
    } else {
      el.classList.remove(HOVER_CLASS);
    }
  });
}
