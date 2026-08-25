import { Loader2 } from "lucide-react";

/**
 * Shared pending UI for the authenticated tree. Used as the TanStack route
 * `pendingComponent` and rendered by the Next `loading.tsx` during the
 * dual-stack window.
 */
export function RoutePending() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
