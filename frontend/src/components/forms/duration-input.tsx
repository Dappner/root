"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface DurationInputProps {
  value?: number; // seconds
  onChange?: (seconds: number) => void;
  placeholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
}

function secondsToHMS(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  if (!totalSeconds || totalSeconds < 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

function hmsToSeconds(hours: number, minutes: number, seconds: number): number {
  return hours * 3600 + minutes * 60 + seconds;
}

export function DurationInput({
  value,
  onChange,
  id,
  "aria-invalid": ariaInvalid,
  disabled,
}: DurationInputProps) {
  const hms = secondsToHMS(value || 0);
  const [hours, setHours] = useState(hms.hours);
  const [minutes, setMinutes] = useState(hms.minutes);
  const [seconds, setSeconds] = useState(hms.seconds);

  // Update local state when external value changes
  useEffect(() => {
    if (value !== undefined) {
      const newHms = secondsToHMS(value);
      setHours(newHms.hours);
      setMinutes(newHms.minutes);
      setSeconds(newHms.seconds);
    }
  }, [value]);

  const handleChange = (type: "hours" | "minutes" | "seconds", rawValue: string) => {
    const numValue = rawValue === "" ? 0 : parseInt(rawValue, 10);
    if (isNaN(numValue) || numValue < 0) return;

    let newHours = hours;
    let newMinutes = minutes;
    let newSeconds = seconds;

    switch (type) {
      case "hours":
        newHours = numValue;
        setHours(numValue);
        break;
      case "minutes":
        // Cap at 59
        newMinutes = Math.min(numValue, 59);
        setMinutes(newMinutes);
        break;
      case "seconds":
        // Cap at 59
        newSeconds = Math.min(numValue, 59);
        setSeconds(newSeconds);
        break;
    }

    const totalSeconds = hmsToSeconds(newHours, newMinutes, newSeconds);
    onChange?.(totalSeconds);
  };

  return (
    <div className="flex items-center gap-2" id={id}>
      <div className="flex-1">
        <Input
          type="number"
          min="0"
          value={hours || ""}
          onChange={(e) => handleChange("hours", e.target.value)}
          placeholder="0"
          className="h-9 text-center"
          aria-label="Hours"
          aria-invalid={ariaInvalid}
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground text-center mt-1">hours</div>
      </div>
      <span className="text-muted-foreground pb-5">:</span>
      <div className="flex-1">
        <Input
          type="number"
          min="0"
          max="59"
          value={minutes || ""}
          onChange={(e) => handleChange("minutes", e.target.value)}
          placeholder="0"
          className="h-9 text-center"
          aria-label="Minutes"
          aria-invalid={ariaInvalid}
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground text-center mt-1">min</div>
      </div>
      <span className="text-muted-foreground pb-5">:</span>
      <div className="flex-1">
        <Input
          type="number"
          min="0"
          max="59"
          value={seconds || ""}
          onChange={(e) => handleChange("seconds", e.target.value)}
          placeholder="0"
          className="h-9 text-center"
          aria-label="Seconds"
          aria-invalid={ariaInvalid}
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground text-center mt-1">sec</div>
      </div>
    </div>
  );
}
