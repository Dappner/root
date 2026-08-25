"use client";

import { useUser } from "@/lib/auth/user-provider";
import type { SourceDTO } from "@/features/sources/types";

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

type GreetingSectionProps = {
  activeSource?: SourceDTO | null;
  recentTakeawayCount?: number;
};

export function GreetingSection({
  activeSource,
  recentTakeawayCount = 0,
}: GreetingSectionProps) {
  const user = useUser();
  const hasActive = !!activeSource;
  const hasTakeaways = recentTakeawayCount > 0;

  const timeOfDay = getTimeOfDay();
  const subtitle = hasActive
    ? "Pick up where you left off"
    : hasTakeaways
      ? "Review your recent takeaways"
      : "What do you want to think about today?";

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-light tracking-tight">
          Good {timeOfDay}, <span className="font-medium">{user.name}</span>
        </h1>
        <p className="text-xl text-muted-foreground font-light">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
