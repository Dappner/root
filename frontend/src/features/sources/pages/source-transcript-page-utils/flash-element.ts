/**
 * Creates a highly visible flash/pulse animation on an element.
 * Uses CSS animation (citation-flash) - simple and performant!
 *
 * @param element - The DOM element to flash
 */
export function flashElement(element: HTMLElement) {
  // Add animation class
  element.classList.add("citation-flash");

  // Remove after animation completes (duration defined in CSS)
  setTimeout(() => {
    element.classList.remove("citation-flash");
  }, 1200);
}
