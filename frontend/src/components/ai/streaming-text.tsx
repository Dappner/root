import { cn } from "@/lib/utils";

interface StreamingCaretProps {
  /** Blinks while tokens are arriving; held steady once the stream settles. */
  streaming?: boolean;
  className?: string;
}

/**
 * Terminal-style caret that trails streamed output.
 *
 * Rendered inline so it sits on the text baseline and flows with the final
 * line of prose rather than floating in its own box.
 */
export function StreamingCaret({ streaming = true, className }: StreamingCaretProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] rounded-[1px] bg-primary align-baseline",
        streaming
          ? "animate-[var(--animate-caret-blink)] motion-reduce:animate-none"
          : "opacity-40",
        className,
      )}
    />
  );
}

interface StreamingTextProps {
  text: string;
  /** Whether the underlying stream is still open. */
  streaming?: boolean;
  className?: string;
}

/**
 * Renders already-streamed text with a trailing caret.
 *
 * Deliberately does not simulate typing: the text prop is real model output
 * arriving as SSE deltas, so re-timing it client-side would only add latency on
 * top of latency. The caret and per-chunk fade supply the sense of motion.
 */
export function StreamingText({ text, streaming = true, className }: StreamingTextProps) {
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {text}
      <StreamingCaret streaming={streaming} />
    </span>
  );
}

interface ShimmerLabelProps {
  children: React.ReactNode;
  /** When false the label renders as plain muted text with no sweep. */
  active?: boolean;
  className?: string;
}

/**
 * Label with a highlight sweeping across it — the "working on it" signal used
 * by reasoning panels and in-flight tool activity.
 */
export function ShimmerLabel({ children, active = true, className }: ShimmerLabelProps) {
  if (!active) {
    return <span className={cn("text-muted-foreground", className)}>{children}</span>;
  }

  return (
    <span
      className={cn(
        "bg-[linear-gradient(90deg,var(--color-muted-foreground)_0%,var(--color-muted-foreground)_35%,var(--color-foreground)_50%,var(--color-muted-foreground)_65%,var(--color-muted-foreground)_100%)]",
        "bg-[length:200%_auto] bg-clip-text text-transparent",
        "animate-[var(--animate-text-shimmer)]",
        "motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
