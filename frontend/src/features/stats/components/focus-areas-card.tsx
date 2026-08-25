import { Info } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FocusArea } from "../types";

interface FocusAreasCardProps {
  areas: FocusArea[];
}

export function FocusAreasCard({ areas }: FocusAreasCardProps) {
  const max = areas.reduce((acc, a) => Math.max(acc, a.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          Current focus areas
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </CardTitle>
        <CardAction>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No focus areas yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {areas.map((area) => {
              const pct = max > 0 ? (area.count / max) * 100 : 0;
              return (
                <li key={area.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="truncate">{area.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {area.count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/70 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
