// Source-coloring shared by full-graph and mini-graph views. Stable across
// renders so the same source always reads as the same color in either surface.

const FALLBACK_COLOR = "#71717a"; // zinc

const SOURCE_PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#10b981", // emerald
  "#0ea5e9", // sky
];

// Separate palette for tag-projected regions. Picked to look good as soft
// gradient washes (slightly desaturated, distinct hue spacing) rather than
// sharp node colors. Used as a fallback when a tag has no user-stored color.
const TAG_PALETTE = [
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#16a34a", // green
  "#ea580c", // orange
  "#db2777", // pink
  "#0284c7", // blue
  "#ca8a04", // yellow-amber
  "#9333ea", // purple
  "#059669", // emerald
  "#dc2626", // red
];

function pickFromPalette(palette: string[], id: number): string {
  return palette[id % palette.length] ?? FALLBACK_COLOR;
}

export function colorForSource(sourceId: number | null | undefined): string {
  if (sourceId == null) return FALLBACK_COLOR;
  return pickFromPalette(SOURCE_PALETTE, sourceId);
}

export function colorForTag(tagId: number): string {
  return pickFromPalette(TAG_PALETTE, tagId);
}
