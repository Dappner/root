import { ArrowUp, Book, FileText, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StatsCounts, StatsMonthDelta } from "../types";

interface StatsGridProps {
  counts: StatsCounts;
  monthDelta?: StatsMonthDelta;
  className?: string;
}

export function StatsGrid({ counts, monthDelta, className }: StatsGridProps) {
  const stats = [
    {
      key: "sources" as const,
      label: "Sources",
      value: counts.sources,
      delta: monthDelta?.sources,
      icon: Book,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      key: "citations" as const,
      label: "Citations",
      value: counts.citations,
      delta: monthDelta?.citations,
      icon: FileText,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      key: "captures" as const,
      label: "Captures",
      value: counts.captures,
      delta: monthDelta?.captures,
      icon: MessageSquare,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      key: "takeaways" as const,
      label: "Takeaways",
      value: counts.takeaways,
      delta: monthDelta?.takeaways,
      icon: Lightbulb,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-6 grid-cols-2 md:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.key} className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn("p-1.5 rounded-md", stat.bg)}>
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <span>{stat.label}</span>
          </div>
          <div className="text-4xl font-bold tracking-tight tabular-nums">
            {stat.value.toLocaleString()}
          </div>
          {stat.delta !== undefined && stat.delta > 0 ? (
            <div className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <ArrowUp className="h-3 w-3" />
              {stat.delta} this month
            </div>
          ) : (
            <div className="text-xs text-muted-foreground/60">
              No change this month
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
