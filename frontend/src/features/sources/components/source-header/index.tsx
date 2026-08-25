"use client";

import { useDialog } from "@/components/dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateCaptureDialog } from "@/features/captures/components/create-capture-dialog";
import { SourcePlayButton } from "@/features/player/components/source-play-button";
import { TagMultiSelect } from "@/features/tags/components/tag-multi-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, ExternalLink, MoreVertical, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CitationDialog } from "../../dialogs/citation-dialog";
import {
  useSource,
  useTransitionSource,
  useUpdateSource,
} from "../../hooks/sources";
import { SourceDTOStatus } from "../../types";
import { buildMetadataBadges, getPrimaryUrl } from "../../utils/metadata";
import { SourceIcon } from "./components/source-icon";

const labelFormSchema = z.object({
  label: z.string().max(100).optional(),
});

interface SourceHeaderProps {
  sourceId: number;
}

export default function SourceHeader({ sourceId }: SourceHeaderProps) {
  const { data: source, isLoading } = useSource(sourceId);
  const { openDialog } = useDialog();
  const updateSource = useUpdateSource();
  const transitionSource = useTransitionSource();

  // State for inline edit mode
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  // Form for label/genre
  const form = useForm<z.infer<typeof labelFormSchema>>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: {
      label: source?.label || "",
    },
  });

  // Reset form when source changes
  useEffect(() => {
    if (source) {
      form.reset({ label: source.label || "" });
    }
  }, [source, form]);

  const handleLabelSave = () => {
    const newLabel = form.getValues("label")?.trim();
    if (newLabel !== (source?.label || "")) {
      updateSource.mutate({
        id: sourceId,
        data: { label: newLabel || undefined },
      });
    }
    setIsEditingLabel(false);
  };

  const handleLabelCancel = () => {
    form.reset({ label: source?.label || "" });
    setIsEditingLabel(false);
  };

  const getLabelPlaceholder = (type: string) => {
    switch (type) {
      case "book": return "Biography, Fiction...";
      case "video": return "Interview, Lecture...";
      default: return "Label...";
    }
  };

  if (isLoading || !source) {
    return (
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Skeleton className="h-7 w-7 mt-1 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-9 w-3/4 max-w-md" />
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
    );
  }

  const sourceUrl = getPrimaryUrl(source);
  const badges = buildMetadataBadges(source);
  const status = source.status;
  const isStatusUpdating = transitionSource.isPending;

  const isPodcast = source.type === "podcast";
  const isVideo = source.type === "video";
  const showMediaImage = (isPodcast || isVideo) && source.image_url;

  // Lifecycle graph: each status's forward (advance) and backward (revert) target.
  const nextStatus: Partial<Record<string, SourceDTOStatus>> = {
    todo: SourceDTOStatus.in_progress,
    in_progress: SourceDTOStatus.reflecting,
    reflecting: SourceDTOStatus.done,
  };
  const prevStatus: Partial<Record<string, SourceDTOStatus>> = {
    in_progress: SourceDTOStatus.todo,
    reflecting: SourceDTOStatus.in_progress,
    done: SourceDTOStatus.reflecting,
  };

  // Advance to next stage
  const handleStatusAdvance = () => {
    if (isStatusUpdating) return;
    const target = nextStatus[status];
    if (target) transitionSource.mutate({ id: sourceId, status: target });
  };

  const statusLabel: Record<string, string> = {
    todo: "To do",
    in_progress: "In progress",
    reflecting: "Reflecting",
    done: "Done",
  };

  const statusColor: Record<string, string> = {
    todo: "bg-slate-400",
    in_progress: "bg-emerald-500",
    reflecting: "bg-blue-500",
    done: "bg-amber-500",
  };

  return (
    <div className="mb-3 md:mb-4">
      {/* Identity Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {showMediaImage ? (
            <div className="size-12 md:size-24 lg:size-28 shrink-0 rounded-lg overflow-hidden border bg-secondary">
              <img
                src={source.image_url}
                alt={source.title || "Media thumbnail"}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <SourceIcon
              type={source.type}
              className="h-7 w-7 text-muted-foreground mt-1 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip>
                <TooltipTrigger render={
                  <h1 className="text-lg md:text-xl lg:text-2xl font-bold tracking-tight line-clamp-2 wrap-break-word cursor-default">
                    {source.title || "Untitled"}
                  </h1>
                }>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs wrap-break-word">{source.title}</p>
                </TooltipContent>
              </Tooltip>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View original source"
                  className="shrink-0"
                >
                  <ExternalLink className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1 md:mt-2 text-sm text-muted-foreground flex-wrap">
              {badges.map((badge, index) => (
                <span key={index} className="flex items-center gap-1.5">
                  {badge}
                  {index < badges.length - 1 && <span>•</span>}
                </span>
              ))}
              {badges.length > 0 && <span>•</span>}
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Badge
                    render={<button type="button" disabled={isStatusUpdating} />}
                    variant="outline"
                    className="h-6 cursor-pointer border-border/70 bg-transparent px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-70"
                  >
                    <span className={`size-1.5 rounded-full ${statusColor[status]}`} />
                    {statusLabel[status]}
                    <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
                  </Badge>
                } />
                <DropdownMenuContent align="start" className="min-w-40">
                  {status !== "todo" && (
                    <DropdownMenuItem onClick={() => {
                      const target = prevStatus[status];
                      if (target) transitionSource.mutate({ id: sourceId, status: target });
                    }}>
                      ← {status === "in_progress" ? "Back to To do" : status === "reflecting" ? "Back to In progress" : "Back to Reflecting"}
                    </DropdownMenuItem>
                  )}
                  {status !== "done" && (
                    <DropdownMenuItem onClick={handleStatusAdvance}>
                      → {status === "todo" ? "Start reading" : status === "in_progress" ? "Begin reflecting" : "Mark done"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Genre and Tags - Inline */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mt-2 md:mt-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">
                  {source.type === 'book' ? 'Genre:' :
                    source.type === 'video' ? 'Format:' :
                      source.type === 'podcast' ? 'Format:' : 'Label:'}
                </label>
                {isEditingLabel ? (
                  <Controller
                    control={form.control}
                    name="label"
                    render={({ field, fieldState }) => (
                      <Field
                        orientation="horizontal"
                        className="gap-1"
                        data-invalid={fieldState.invalid}
                      >
                        <Input
                          {...field}
                          placeholder={getLabelPlaceholder(source.type)}
                          className="h-7 w-44 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleLabelSave();
                            } else if (e.key === "Escape") {
                              handleLabelCancel();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={handleLabelSave}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={handleLabelCancel}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Field>
                    )}
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-sm">
                      {source.label || <span className="text-muted-foreground italic">Not set</span>}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsEditingLabel(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="text-sm text-muted-foreground whitespace-nowrap">
                  Tags:
                </label>
                <TagMultiSelect
                  selectedTagIds={source.tag_ids || []}
                  onChange={(newTagIds) => {
                    updateSource.mutate({
                      id: sourceId,
                      data: { tag_ids: newTagIds },
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop: Show all buttons */}
          <div className="hidden md:flex items-center gap-2">
            <SourcePlayButton source={source} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDialog(CitationDialog, {
                mode: "create",
                flow: "manual",
                sourceId,
              })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Quote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                openDialog(CreateCaptureDialog, {
                  sourceId,
                  sourceTitle: source.title ?? "Untitled",
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Comment
            </Button>
          </div>

          {/* Mobile: Overflow menu for Add Quote / Add Comment */}
          <div className="flex md:hidden items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="sm" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => openDialog(CitationDialog, {
                    mode: "create",
                    flow: "manual",
                    sourceId,
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Quote
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    openDialog(CreateCaptureDialog, {
                      sourceId,
                      sourceTitle: source.title ?? "Untitled",
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Comment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
