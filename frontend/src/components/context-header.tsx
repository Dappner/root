"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Button } from "./ui/button";

interface ContextHeaderProps {
  /** Primary context (e.g., source title) */
  primary?: {
    label: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  };
  /** Secondary context (e.g., section title) */
  secondary?: {
    label: string;
  };
  /** Empty state when no context is selected */
  emptyState?: {
    label: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
    onAction?: () => void;
    actionLabel?: string;
  };
  /** Optional change action */
  onChange?: () => void;
  /** Optional className for customization */
  className?: string;
}

/**
 * Unified context header for dialogs.
 * Shows breadcrumb-style hierarchy (Source → Section) or empty state.
 *
 * @example
 * // With source and section
 * <ContextHeader
 *   primary={{ label: "The Power Law", icon: BookOpen }}
 *   secondary={{ label: "Introduction" }}
 *   onChange={() => openSourceSelector()}
 * />
 *
 * @example
 * // Empty state
 * <ContextHeader
 *   emptyState={{
 *     label: "No source selected",
 *     icon: BookOpen,
 *     onAction: () => openSourceSelector(),
 *     actionLabel: "Add source"
 *   }}
 * />
 */
export function ContextHeader({
  primary,
  secondary,
  emptyState,
  onChange,
  className,
}: ContextHeaderProps) {
  // If no primary context, show empty state
  if (!primary && emptyState) {
    const Icon = emptyState.icon;
    return (
      <div
        className={`
          px-3 py-2.5
          bg-muted/30 border rounded-md
          ${className || ""}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span>{emptyState.label}</span>
          </div>
          {emptyState.onAction && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={emptyState.onAction}
              className="h-7 text-xs"
            >
              {emptyState.actionLabel || "Add"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show primary + secondary breadcrumb
  if (primary) {
    const PrimaryIcon = primary.icon;
    return (
      <div
        className={`
          px-3 py-2.5
          bg-muted/30 border rounded-md
          ${className || ""}
        `}
      >
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            {PrimaryIcon && (
              <PrimaryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium truncate">{primary.label}</span>

            {secondary && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  {secondary.label}
                </span>
              </>
            )}
          </div>

          {onChange && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onChange}
              className="h-7 text-xs shrink-0"
            >
              Change
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No context at all - don't render anything
  return null;
}
