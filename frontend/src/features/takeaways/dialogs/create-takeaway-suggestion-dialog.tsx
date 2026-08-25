"use client";

import { BaseDialogProps } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTakeaway } from "@/features/takeaways/hooks";
import { plainTextToTipTapDoc } from "@/features/takeaways/utils/body-json";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CreateTakeawaySuggestionDialogProps extends BaseDialogProps {
  sourceId: number;
  title: string;
  body: string;
  citationIds?: number[];
  captureIds?: number[];
}

export function CreateTakeawaySuggestionDialog({
  open,
  onOpenChange,
  sourceId,
  title: initialTitle,
  body: initialBody,
  citationIds = [],
  captureIds = [],
}: CreateTakeawaySuggestionDialogProps) {
  const createTakeaway = useCreateTakeaway();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    try {
      await createTakeaway.mutateAsync({
        sourceId,
        data: {
          title: trimmedTitle,
          body_json: plainTextToTipTapDoc(body.trim()),
          citation_ids: citationIds,
          capture_ids: captureIds,
        },
      });
      toast.success("Takeaway created");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create takeaway");
    }
  };

  const handleKeyDown = useMetaEnter(() => {
    void handleSubmit();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Takeaway</DialogTitle>
        </DialogHeader>

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="takeaway-title">Title</FieldLabel>
              <Input
                id="takeaway-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="takeaway-body">Body</FieldLabel>
              <Textarea
                id="takeaway-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={createTakeaway.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={createTakeaway.isPending || !title.trim()}
            onClick={handleSubmit}
          >
            {createTakeaway.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
