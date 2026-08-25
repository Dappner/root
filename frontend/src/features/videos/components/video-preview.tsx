"use client";

import { formatTime } from "@/lib/utils";
import { VideoDTO } from "../types";

interface VideoPreviewProps {
  video: VideoDTO;
}

export function VideoPreview({ video }: VideoPreviewProps) {
  return (
    <div className="flex gap-4 p-3 rounded-lg border bg-muted/30 overflow-hidden">
      {video.thumbnail_url && (
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className="w-32 h-auto rounded object-cover aspect-video shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="font-medium text-sm leading-snug line-clamp-2">{video.title}</h4>
        {video.description && (
          <p className="text-xs text-muted-foreground truncate mt-1">
            {video.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {video.duration && <span>{formatTime(video.duration)}</span>}
          {video.view_count && (
            <span>{video.view_count.toLocaleString()} views</span>
          )}
        </div>
      </div>
    </div>
  );
}
