"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;

type SlideoverVariant = "overlay" | "embedded";

interface RightSlideoverProps {
  open: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /**
   * "overlay" (default): floats above content, fixed to the viewport's right
   * edge, sliding in/out — optionally behind a click-outside backdrop.
   *
   * "embedded": participates in layout flow as a flex sibling, animating its
   * width so neighbouring content reflows (companion-panel behavior). No
   * backdrop; the parent must be a flex row and give the panel a sibling that
   * can shrink (e.g. `flex-1 min-w-0`).
   */
  variant?: SlideoverVariant;
  /**
   * When true, render without the click-outside backdrop. Use this when the
   * panel sits alongside interactive content the user is meant to keep using
   * (companion panel behavior). Escape still closes it. Ignored for the
   * "embedded" variant, which never has a backdrop.
   */
  disableBackdrop?: boolean;
}

export function RightSlideover({
  open,
  width,
  onWidthChange,
  onClose,
  children,
  className,
  variant = "overlay",
  disableBackdrop = false,
}: RightSlideoverProps) {
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const isEmbedded = variant === "embedded";

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startX - ev.clientX;
        onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };

      const cleanup = () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", cleanup);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", cleanup);

      return cleanup;
    },
    [width, onWidthChange],
  );

  // Cancel any in-progress drag when the panel closes or unmounts. The global
  // mouseup cleanup also resets `isDragging`, so we only need the ref here.
  useEffect(() => {
    if (!open) {
      isDraggingRef.current = false;
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const dragHandle = (
    <div
      onMouseDown={handleResizeMouseDown}
      className="absolute left-0 top-0 h-full w-1 cursor-col-resize z-10 hover:bg-border/60 active:bg-border transition-colors"
    />
  );

  if (isEmbedded) {
    // In-flow companion panel: width drives the sibling reflow. The width
    // transition runs only for open/close — never during a drag, where it would
    // lag behind the cursor and look like the panel grows from its middle.
    return (
      <div
        className={cn(
          "relative h-full shrink-0 overflow-hidden bg-background",
          !isDragging && "transition-[width] duration-200 ease-in-out",
          isDragging && "select-none",
          open && "border-l border-border",
          className,
        )}
        style={{ width: open ? width : 0 }}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {dragHandle}
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — subtle, doesn't block interaction. Skipped for companion
          panels so the content behind stays clickable. */}
      {open && !disableBackdrop && (
        <div
          className="fixed inset-0 z-30"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex flex-col bg-background shadow-2xl border-l border-border",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
        style={{ width }}
      >
        {dragHandle}

        <div className="flex h-full flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
