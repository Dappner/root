"use client";

import { DialogForm, DialogFormFooter, useDialogRuntime, WithDialogResult } from "@/components/dialogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateCollection } from "@/features/collections/hooks";
import type { CollectionDTO } from "@/features/collections/types";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { useState } from "react";

interface EditCollectionDialogProps extends WithDialogResult<CollectionDTO> {
  collection: CollectionDTO;
}

export function EditCollectionDialog({ collection }: EditCollectionDialogProps) {
  const { resolve } = useDialogRuntime();
  const updateCollection = useUpdateCollection();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;

    try {
      const updated = await updateCollection.mutateAsync({
        id: collection.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
        },
      });
      resolve(updated);
    } catch (error) {
      console.error("Failed to update collection:", error);
    }
  };

  const handleKeyDown = useMetaEnter(() => handleSubmit());

  return (
    <DialogForm
      title="Edit Collection"
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="collection-description">Description <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="collection-description"
            placeholder="What is this collection about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <DialogFormFooter
        submitLabel="Save Changes"
        pending={updateCollection.isPending}
        cancelDisabled={updateCollection.isPending}
      />
    </DialogForm>
  );
}
