"use client";

import { DialogForm, DialogFormFooter, useDialogRuntime } from "@/components/dialogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCollection } from "@/features/collections/hooks";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { useState } from "react";

export function CreateCollectionDialog() {
  const { resolve } = useDialogRuntime();
  const createCollection = useCreateCollection();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;

    try {
      const created = await createCollection.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      resolve(created);
    } catch (error) {
      console.error("Failed to create collection:", error);
    }
  };

  const handleKeyDown = useMetaEnter(() => handleSubmit());

  return (
    <DialogForm
      title="Create Collection"
      description="Group your sources into a collection."
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            placeholder="e.g. Monthly Newsletters"
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
        submitLabel="Create Collection"
        pending={createCollection.isPending}
        cancelDisabled={createCollection.isPending}
      />
    </DialogForm>
  );
}
