"use client";

import { AutoGrowTextarea } from "@/components/forms/auto-grow-textarea";
import { useUpdateSection } from "@/features/sources/hooks/sections";
import type { SourceSectionDTO } from "@/features/sources/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SectionSummaryProps {
  sourceId: number;
  section: SourceSectionDTO;
}

export function SectionSummary({ sourceId, section }: SectionSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(section.summary || "");
  const updateSection = useUpdateSection(sourceId, section.id);

  // Sync with external updates
  useEffect(() => {
    setValue(section.summary || "");
  }, [section.summary]);

  const handleSave = () => {
    // Only save if changed
    if (value !== (section.summary || "")) {
      updateSection.mutate(
        {
          title: section.title,
          summary: value,
          range_start: section.range_start,
          range_end: section.range_end,
        },
        {
          onError: () => toast.error("Failed to save summary"),
        }
      );
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      setValue(section.summary || "");
    }
  };

  if (isEditing) {
    return (
      <div className="mt-2 -mx-2" onClick={(e) => e.stopPropagation()}>
        <AutoGrowTextarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="text-sm bg-background/50 border border-border/50 rounded-md px-2 py-2 focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="Add summary..."
          autoFocus
          minRows={2}
          maxRows={6}
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        "mt-1 text-sm cursor-text rounded transition-colors",
        section.summary
          ? "text-muted-foreground hover:text-foreground"
          : "text-muted-foreground/50 italic hover:text-muted-foreground"
      )}
    >
      {section.summary || "Add summary..."}
    </div>
  );
}
