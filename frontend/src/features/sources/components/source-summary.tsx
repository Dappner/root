"use client";

import type { SourceDTO } from "@/features/sources/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateSourceSummaries } from "@/features/sources/hooks/sources";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SourceSummaryProps {
  source: SourceDTO;
}

export function SourceSummary({ source }: SourceSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(source.summary_long || "");
  const updateSummaries = useUpdateSourceSummaries();

  const charLimit = 600;
  const charCount = value.length;

  const handleEdit = () => {
    setValue(source.summary_long || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setValue(source.summary_long || "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateSummaries.mutateAsync({
        id: source.id,
        data: {
          summary_long: value || undefined,
        },
      });

      toast.success("Summary updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update summary:", error);
      toast.error("Failed to update summary");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Summary</h3>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {isEditing ? (
          <>
            <div className="relative">
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="A detailed summary or notes about this source"
                rows={15}
                autoFocus
                className="pr-16"
              />
              <span
                className={`absolute bottom-3 right-3 text-xs pointer-events-none ${charCount > charLimit
                    ? "text-destructive"
                    : "text-muted-foreground"
                  }`}
              >
                {charCount}/{charLimit}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateSummaries.isPending}
              >
                <Check className="w-3 h-3 mr-1" />
                {updateSummaries.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={updateSummaries.isPending}
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed">
            {source.summary_long || (
              <span className="text-muted-foreground italic">
                No summary yet. Click &quot;Edit&quot; to add one.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
