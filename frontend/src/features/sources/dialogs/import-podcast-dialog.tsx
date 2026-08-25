"use client";

import { useRouter } from "@/lib/nav";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

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
import { useImportPodcast } from "@/features/sources/hooks/sources";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { routes } from "@/lib/routes";

const importSchema = z.object({
  apple_url: z.string().url("Enter a valid Apple Podcasts URL"),
});

type ImportForm = z.infer<typeof importSchema>;

export function ImportPodcastDialog({ open, onOpenChange }: BaseDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<ImportForm>({ apple_url: "" });
  const importPodcast = useImportPodcast();

  const onSubmit = () => {
    const parsed = importSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }

    importPodcast.mutate(parsed.data, {
      onSuccess: (show) => {
        if (!show.slug) {
          toast.info("Show imported but Slug is missing.");
          return;
        }

        toast.success("Podcast syndicated");
        onOpenChange(false);

        router.push(routes.discoverPodcastShow(show.slug));
      },
      onError: (err: any) => {
        toast.error(err?.message || "Import failed. Check the URL and try again.");
      },
    });
  };
  const handleKeyDown = useMetaEnter(onSubmit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Import from Apple Podcasts</DialogTitle>
        </DialogHeader>
        <FieldGroup className="space-y-4">
          <Field>
            <FieldLabel>Apple Podcasts URL</FieldLabel>
            <Input
              value={form.apple_url}
              onChange={(e) => setForm((prev) => ({ ...prev, apple_url: e.target.value }))}
              placeholder="https://podcasts.apple.com/..."
            />
          </Field>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onSubmit} disabled={importPodcast.isPending}>
              {importPodcast.isPending ? "Importing..." : "Import Show"}
            </Button>
          </DialogFooter>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
