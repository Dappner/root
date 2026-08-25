"use client";

import { BaseDialogProps } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateTakeaway, useTakeaways, useUpdateTakeaway } from "@/features/takeaways/hooks";
import { bodyJsonOrFallback, plainTextToTipTapDoc } from "@/features/takeaways/utils/body-json";
import { Check, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AddToTakeawayDialogProps extends BaseDialogProps {
  sourceId: number;
  citationId: number;
}

export function AddToTakeawayDialog({
  open,
  onOpenChange,
  sourceId,
  citationId,
}: AddToTakeawayDialogProps) {
  const [newTakeawayTitle, setNewTakeawayTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: takeaways, isLoading } = useTakeaways(sourceId);
  const createTakeaway = useCreateTakeaway();
  const updateTakeaway = useUpdateTakeaway();

  const canCreate = (takeaways?.length || 0) < 5;

  const handleSelectTakeaway = async (takeawayId: number) => {
    const takeaway = takeaways?.find((t) => t.id === takeawayId);
    if (!takeaway) return;

    // Check if already added
    const currentCitationIds = takeaway.citations?.map((c) => c.id) || [];
    if (currentCitationIds.includes(citationId)) {
      toast.info("Citation is already in this takeaway");
      onOpenChange(false);
      return;
    }

    try {
      await updateTakeaway.mutateAsync({
        sourceId,
        takeawayId,
        data: {
          title: takeaway.title,
          body_json: bodyJsonOrFallback(takeaway.body_json, takeaway.body),
          citation_ids: [...currentCitationIds, citationId],
          capture_ids: takeaway.captures?.map((c) => c.id) || [],
        },
      });
      toast.success("Added to takeaway");
      onOpenChange(false);
    } catch {
      toast.error("Failed to add to takeaway");
    }
  };

  const handleCreateTakeaway = async () => {
    if (!newTakeawayTitle.trim()) return;
    if (!canCreate) {
      toast.error("Maximum 5 takeaways allowed per source");
      return;
    }

    try {
      await createTakeaway.mutateAsync({
        sourceId,
        data: {
          title: newTakeawayTitle,
          body_json: plainTextToTipTapDoc(""),
          citation_ids: [citationId],
          capture_ids: [],
        },
      });
      toast.success("Created takeaway and added citation");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create takeaway");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Takeaway</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {takeaways && takeaways.length > 0 ? (
                <div className="grid gap-2">
                  {takeaways.map((takeaway) => {
                    const isAdded = takeaway.citations?.some((c) => c.id === citationId);
                    return (
                      <button
                        key={takeaway.id}
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleSelectTakeaway(takeaway.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left group ${
                          isAdded
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted/50 cursor-pointer"
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">{takeaway.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {takeaway.citations?.length || 0} citations
                          </span>
                        </div>
                        {isAdded ? (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No takeaways created yet.
                </p>
              )}

              <div className="pt-2">
                {isCreating ? (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                    <Input
                      placeholder="Takeaway title..."
                      value={newTakeawayTitle}
                      onChange={(e) => setNewTakeawayTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateTakeaway();
                        if (e.key === "Escape") setIsCreating(false);
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreating(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateTakeaway}
                        disabled={!newTakeawayTitle.trim() || createTakeaway.isPending}
                      >
                        {createTakeaway.isPending && (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        )}
                        Create & Add
                      </Button>
                    </div>
                  </div>
                ) : (
                  canCreate && (
                    <Button
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={() => {
                        setNewTakeawayTitle("");
                        setIsCreating(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Takeaway
                    </Button>
                  )
                )}
                {!canCreate && !isCreating && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Maximum of 5 takeaways reached for this source.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
