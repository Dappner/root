"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface AutoGrowTextareaProps
  extends React.ComponentProps<"textarea"> {
  minRows?: number;
  maxRows?: number;
}

/**
 * Adaptive textarea that grows from minRows to maxRows, then scrolls.
 *
 * Behavior:
 * - Starts at minRows (default 3)
 * - Auto-grows as user types
 * - Stops growing at maxRows (default 8)
 * - After maxRows, enables internal scroll
 *
 * @example
 * <AutoGrowTextarea
 *   placeholder="Enter text..."
 *   minRows={3}
 *   maxRows={8}
 * />
 */
export const AutoGrowTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoGrowTextareaProps
>(({ className, minRows = 3, maxRows = 8, onChange, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
  const lineHeight = 16; // Approximate line height in pixels for text-xs (1rem)

  // Combine refs
  React.useImperativeHandle(ref, () => internalRef.current!);

  const adjustHeight = React.useCallback(() => {
    const textarea = internalRef.current;
    if (!textarea) return;

    // Reset height to calculate scrollHeight accurately
    textarea.style.height = "auto";

    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= minHeight) {
      textarea.style.height = `${minHeight}px`;
      textarea.style.overflowY = "hidden";
    } else if (scrollHeight <= maxHeight) {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = "hidden";
    } else {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    }
  }, [minRows, maxRows, lineHeight]);

  // Adjust on mount and when value changes
  React.useEffect(() => {
    adjustHeight();
  }, [adjustHeight, props.value, props.defaultValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    onChange?.(e);
  };

  return (
    <textarea
      data-slot="textarea"
      ref={internalRef}
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-none border bg-transparent px-2.5 py-2 text-xs transition-colors focus-visible:ring-1 aria-invalid:ring-1 md:text-xs placeholder:text-muted-foreground flex w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "resize-none", // Disable manual resize
        className
      )}
      rows={minRows}
      onChange={handleChange}
      {...props}
    />
  );
});

AutoGrowTextarea.displayName = "AutoGrowTextarea";
