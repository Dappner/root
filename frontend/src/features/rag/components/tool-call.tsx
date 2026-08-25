"use client";

import { ActivityResult, ToolActivity } from "@/components/ai/tool-activity";
import { prettifyToolName, toolIcon } from "../display";
import type { ChatItem } from "../types";

interface ToolCallItemProps {
  item: Extract<ChatItem, { kind: "tool_call" }>;
}

interface SearchStats {
  total?: number;
  citations?: number;
  captures?: number;
  takeaways?: number;
  sections?: number;
}

/** Plural-aware row label, e.g. 1 → "1 highlight", 4 → "4 highlights". */
function countLabel(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export function ToolCallItem({ item }: ToolCallItemProps) {
  const stats =
    item.status === "done" && item.metadata?.stats
      ? (item.metadata.stats as SearchStats)
      : null;

  const label = item.display?.label ?? prettifyToolName(item.name);
  const title = item.display?.title ?? label;
  const subject = item.display?.detail;
  const summary = item.display?.summary ?? item.summary;

  // The backend reports what a search matched as aggregate counts rather than
  // individual hits, so each retrieved entity kind becomes one row. Kinds the
  // tool did not touch are omitted rather than shown as zero.
  const rows = stats
    ? (
        [
          { value: stats.citations, singular: "highlight", detail: "quotes from your sources" },
          { value: stats.captures, singular: "note", detail: "your own captures" },
          { value: stats.takeaways, singular: "takeaway", detail: "synthesized insights" },
          { value: stats.sections, singular: "section", detail: "section summaries" },
        ] as const
      ).flatMap(({ value, singular, detail }) =>
        value ? [{ title: countLabel(value, singular), detail }] : [],
      )
    : [];

  const errorRow = item.status === "error" ? (item.error ?? "Tool call failed") : null;
  const summaryRow = item.status === "done" && summary && rows.length === 0 ? summary : null;

  const hasRows = rows.length > 0 || Boolean(errorRow) || Boolean(summaryRow);

  return (
    <div className="ml-1">
      <ToolActivity
        status={item.status}
        icon={toolIcon(item.name)}
        label={title}
        subject={subject}
      >
        {hasRows ? (
          <>
            {rows.map((row) => (
              <ActivityResult
                key={row.title}
                state="done"
                title={row.title}
                detail={row.detail}
              />
            ))}
            {summaryRow && <ActivityResult state="done" title={summaryRow} />}
            {errorRow && (
              <li className="text-xs leading-[18px] text-destructive">{errorRow}</li>
            )}
          </>
        ) : undefined}
      </ToolActivity>
    </div>
  );
}
