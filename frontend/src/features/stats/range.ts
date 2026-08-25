export interface RangeOption {
  label: string;
  weeks: number;
}

// Approx mapping of days → weeks. We render in weekly buckets, so picking
// "30 days" yields ~4 buckets, "365 days" yields ~52 (max API allows is 53).
export const RANGE_OPTIONS: RangeOption[] = [
  { label: "30 days", weeks: 4 },
  { label: "90 days", weeks: 12 },
  { label: "180 days", weeks: 26 },
  { label: "365 days", weeks: 52 },
];

export const DEFAULT_WEEKS_BACK = 12;
