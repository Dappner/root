"use client";

import type { SourceSectionDTO } from "@/features/sources/types";
import {
  ArrowDown,
  ArrowUp,
  Highlighter,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import { ReactNode } from "react";

export interface SectionMenuItemsProps {
  section: SourceSectionDTO;
  isFirstSibling: boolean;
  isLastSibling: boolean;
  allSections: SourceSectionDTO[];
  sourceId: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddQuote: () => void;
  onAddCapture: () => void;
  ItemComponent: React.ComponentType<{
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    variant?: "default" | "destructive";
  }>;
  SeparatorComponent: React.ComponentType;
}

export function SectionMenuItems({
  isFirstSibling,
  isLastSibling,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddQuote,
  onAddCapture,
  ItemComponent,
  SeparatorComponent,
}: SectionMenuItemsProps) {
  return (
    <>
      <ItemComponent onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        Edit Section
      </ItemComponent>

      <SeparatorComponent />

      <ItemComponent disabled={isFirstSibling} onClick={onMoveUp}>
        <ArrowUp className="h-4 w-4" />
        Move before previous
      </ItemComponent>
      <ItemComponent disabled={isLastSibling} onClick={onMoveDown}>
        <ArrowDown className="h-4 w-4" />
        Move after next
      </ItemComponent>

      <SeparatorComponent />

      <ItemComponent onClick={onAddQuote}>
        <Highlighter className="h-4 w-4" />
        Add Quote
      </ItemComponent>
      <ItemComponent onClick={onAddCapture}>
        <NotebookPen className="h-4 w-4" />
        Add Comment
      </ItemComponent>

      <SeparatorComponent />

      <ItemComponent variant="destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
        Delete Section
      </ItemComponent>
    </>
  );
}

// Icon component for the menu trigger button
export const SectionMenuIcon = MoreHorizontal;
