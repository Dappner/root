"use client";

import { Slider } from "@/components/ui/slider";

interface GraphToolbarProps {
  threshold: number;
  onThresholdChange: (value: number) => void;
  tagThreshold: number;
  onTagThresholdChange: (value: number) => void;
  showClusters: boolean;
  onShowClustersChange: (value: boolean) => void;
  showRegions: boolean;
  onShowRegionsChange: (value: boolean) => void;
}

export function GraphToolbar({
  threshold,
  onThresholdChange,
  tagThreshold,
  onTagThresholdChange,
  showClusters,
  onShowClustersChange,
  showRegions,
  onShowRegionsChange,
}: GraphToolbarProps) {
  const handleSliderChange = (cb: (n: number) => void) => (
    value: number | readonly number[],
  ) => {
    const next = Array.isArray(value) ? value[0] : (value as number);
    if (typeof next === "number") cb(next);
  };

  return (
    <div className="absolute top-4 left-4 rounded-md border bg-card/95 backdrop-blur shadow-sm p-3 w-60 space-y-4">
      <div className="space-y-2">
        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Region labels
          </span>
          <input
            type="checkbox"
            checked={showClusters}
            onChange={(event) => onShowClustersChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-foreground cursor-pointer"
          />
        </label>
        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Region colors
          </span>
          <input
            type="checkbox"
            checked={showRegions}
            onChange={(event) => onShowRegionsChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-foreground cursor-pointer"
          />
        </label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="similarity-threshold"
            className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold"
          >
            Similarity
          </label>
          <span className="text-xs font-mono tabular-nums text-foreground">
            {threshold.toFixed(2)}
          </span>
        </div>
        <Slider
          id="similarity-threshold"
          min={0}
          max={1}
          step={0.01}
          value={[threshold]}
          onValueChange={handleSliderChange(onThresholdChange)}
        />
        <p className="text-[10px] text-muted-foreground leading-snug">
          Hides semantic edges below this score. Shared-citation links
          always show.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="tag-threshold"
            className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold"
          >
            Tag overlap
          </label>
          <span className="text-xs font-mono tabular-nums text-foreground">
            {tagThreshold.toFixed(2)}
          </span>
        </div>
        <Slider
          id="tag-threshold"
          min={0}
          max={1}
          step={0.01}
          value={[tagThreshold]}
          onValueChange={handleSliderChange(onTagThresholdChange)}
        />
        <p className="text-[10px] text-muted-foreground leading-snug">
          Source ↔ source jaccard over tags. Lower = more inter-source
          links.
        </p>
      </div>
    </div>
  );
}
