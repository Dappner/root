"use client";

import { Info, Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS } from "../range";
import type { WeeklyTrend } from "../types";

interface ActivityChartProps {
  trends: WeeklyTrend[];
  weeksBack?: number;
  onWeeksBackChange?: (weeksBack: number) => void;
  isRefetching?: boolean;
}

export function ActivityChart({
  trends,
  weeksBack,
  onWeeksBackChange,
  isRefetching = false,
}: ActivityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          Activity over time
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </CardTitle>
        {onWeeksBackChange && weeksBack !== undefined && (
          <CardAction>
            <Select
              value={String(weeksBack)}
              onValueChange={(v) => onWeeksBackChange(Number(v))}
            >
              <SelectTrigger
                size="sm"
                className="h-7 text-xs px-2 gap-1.5 w-auto"
              >
                <SelectValue>
                  {RANGE_OPTIONS.find((o) => o.weeks === weeksBack)?.label ??
                    `${weeksBack} weeks`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.weeks} value={String(option.weeks)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="relative">
        {isRefetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px] pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {trends.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="week_start"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(value) => {
                  const date = new Date(value as string);
                  return `Week of ${date.toLocaleDateString()}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="sources_count"
                stroke="#3b82f6"
                name="Sources"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="citations_count"
                stroke="#10b981"
                name="Citations"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="captures_count"
                stroke="#f59e0b"
                name="Captures"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="takeaways_count"
                stroke="#ef4444"
                name="Takeaways"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
