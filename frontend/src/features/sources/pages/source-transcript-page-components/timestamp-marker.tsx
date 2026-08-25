"use client";

import { formatTime } from "@/lib/utils";

interface TimestampMarkerProps {
  time: number;
  markerIndex: number;
  onSeek: (time: number) => void;
}

export function TimestampMarker({
  time,
  markerIndex,
  onSeek,
}: TimestampMarkerProps) {
  return (
    <div className="w-14 shrink-0 select-none">
      <button
        type="button"
        onClick={() => onSeek(time)}
        id={`ts-marker-${markerIndex}`}
        data-marker-index={markerIndex}
        data-marker-time={time}
        className="ts-marker"
      >
        {formatTime(time)}
      </button>
    </div>
  );
}
