"use client";

import type { SourceDTO } from "@/features/sources/types";
import { getSourceLabel } from "@/features/sources/utils/source-type-meta";
import { formatDateUTC } from "@/lib/utils/date";
import { Calendar, FileText, Link2, User } from "lucide-react";

interface SourceAboutProps {
  source: SourceDTO;
}

interface Row {
  icon: typeof Calendar;
  label: string;
  value: React.ReactNode;
}

export function SourceAbout({ source }: SourceAboutProps) {
  const rows: Row[] = [
    {
      icon: Calendar,
      label: "Added",
      value: formatDateUTC(source.created_at, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
  ];

  if (source.author) {
    rows.push({
      icon: User,
      label: "Author",
      value: source.author,
    });
  }

  rows.push({
    icon: FileText,
    label: "Source type",
    value: getSourceLabel(source.type),
  });

  rows.push({
    icon: Link2,
    label: "Link",
    value: source.source_url ? (
      <a
        href={source.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate underline-offset-4 hover:underline"
      >
        {source.source_url}
      </a>
    ) : (
      <span className="text-muted-foreground">—</span>
    ),
  });

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">About this source</h3>
      <dl className="space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <dt className="w-28 shrink-0 text-muted-foreground">{row.label}</dt>
              <dd className="flex-1 truncate">{row.value}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
