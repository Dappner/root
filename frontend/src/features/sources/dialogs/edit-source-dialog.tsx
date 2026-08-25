"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SourceDTO } from "@/features/sources/types";
import { BaseDialogProps } from "@/components/dialogs";
import { PodcastEditForm } from "../components/podcast-edit-form";
import { GenericSourceForm } from "../components/generic-source-form";
import { LinkedSourceForm } from "../components/linked-source-form";

interface EditSourceDialogProps extends BaseDialogProps {
  source: SourceDTO;
}

export function EditSourceDialog({
  open,
  onOpenChange,
  source,
}: EditSourceDialogProps) {
  const isPodcast = source.type === "podcast" && source.episode_id;
  const isLinkedVideo = source.type === "video" && source.video_id;

  // Determine the title based on source type
  const getTitle = () => {
    if (isPodcast) return "Edit Podcast";
    if (isLinkedVideo) return "Edit Video";
    return "Edit Source";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        {isPodcast ? (
          <PodcastEditForm
            source={source}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : isLinkedVideo ? (
          <LinkedSourceForm
            source={source}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <GenericSourceForm
            source={source}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
