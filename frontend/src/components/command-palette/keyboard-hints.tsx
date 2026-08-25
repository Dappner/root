import { cn } from "@/lib/utils";

const KEYBOARD_HINTS = [
  { keys: ["↑↓"], label: "Navigate" },
  { keys: ["↵"], label: "Select" },
  { keys: ["ESC"], label: "Close" },
];

interface KeyboardHintsProps {
  className?: string;
  leaderKey?: string;
}

function formatLeaderKey(key: string) {
  if (key === " ") return "Space";
  return key;
}

export function KeyboardHints({ className, leaderKey }: KeyboardHintsProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {KEYBOARD_HINTS.map((hint) => (
          <span key={hint.label} className="flex items-center gap-1">
            {hint.keys.map((key) => (
              <kbd
                key={key}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {key}
              </kbd>
            ))}
            {hint.label}
          </span>
        ))}
      </div>

      {leaderKey && (
        <span className="flex items-center gap-1">
          Leader
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {formatLeaderKey(leaderKey)}
          </kbd>
        </span>
      )}
    </div>
  );
}
