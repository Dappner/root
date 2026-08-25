"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useCreateTag, useTags } from "../hooks";
import { TagChips } from "./tag-chips";

interface TagMultiSelectProps {
  selectedTagIds: number[];
  onChange: (newTagIds: number[]) => void;
}

export function TagMultiSelect({
  selectedTagIds,
  onChange,
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const createTagMutation = useCreateTag();

  const { data: allTags = [], isLoading } = useTags();

  type HydratedTag = {
    id: number;
    label: string;
    slug: string;
    color?: string;
  };

  const tags: HydratedTag[] = allTags
    .filter((tag) => typeof tag.id === "number" && !!tag.label && !!tag.slug)
    .map((tag) => ({
      id: tag.id as number,
      label: tag.label as string,
      slug: tag.slug as string,
      color: typeof tag.color === "string" ? tag.color : undefined,
    }));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-28" />
      </div>
    );
  }

  const handleSelect = (tagId: number) => {
    const newSelection = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onChange(newSelection);
  };

  const handleRemove = (tagId: number) => {
    const newSelection = selectedTagIds.filter((id) => id !== tagId);
    onChange(newSelection);
  };

  const handleCreateNewTag = async () => {
    if (newTagInput.trim() === "") return;

    const newLabel = newTagInput.trim();
    const newSlug = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-*|-*$/g, "");

    const existingTag = tags.find(
      (tag) => tag.slug === newSlug || tag.label.toLowerCase() === newLabel.toLowerCase(),
    );

    if (existingTag) {
      if (!selectedTagIds.includes(existingTag.id)) {
        onChange([...selectedTagIds, existingTag.id]);
      }
      setNewTagInput("");
      return;
    }

    try {
      const createdTag = await createTagMutation.mutateAsync({
        label: newLabel,
        slug: newSlug,
      });
      if (createdTag.id) {
        onChange([...selectedTagIds, createdTag.id]);
      }
      setNewTagInput("");
    } catch (error) {
      console.error("Failed to create new tag:", error);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <TagChips
        tagIds={selectedTagIds}
        onRemove={handleRemove}
        className="flex items-center gap-1.5 flex-wrap"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-full"
            aria-label="Add tag"
          >
            <Plus className="h-4 w-4" />
          </Button>
        }>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm">
                  <p className="text-muted-foreground">No tags found.</p>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => handleSelect(tag.id)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-input",
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-3" />}
                      </div>
                      <span className={cn(isSelected && "font-medium")}>{tag.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              {/* Create new tag section */}
              <CommandSeparator />
              <CommandGroup>
                <div className="p-2 space-y-2">
                  <p className="text-xs text-muted-foreground px-2">Create new tag</p>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Tag name"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateNewTag();
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      onClick={handleCreateNewTag}
                      size="sm"
                      className="h-8 px-3"
                      disabled={!newTagInput.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
