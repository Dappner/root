import { useSession } from "@/lib/auth/client";
import { Link } from "@/lib/nav";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const primaryLinkClass =
  "inline-flex h-8 items-center justify-center whitespace-nowrap border border-transparent bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-all outline-none hover:bg-primary/80";

const secondaryLinkClass =
  "inline-flex h-8 items-center justify-center whitespace-nowrap border border-border bg-background px-2.5 text-xs font-medium transition-all outline-none hover:bg-muted hover:text-foreground";

/**
 * Shared 404 UI. Used as the TanStack router `notFoundComponent` and rendered
 * by the Next `not-found.tsx` during the dual-stack window. The home link
 * adapts to auth state.
 */
export function RouteNotFound() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const homeHref = isAuthenticated ? routes.root : routes.login;
  const homeLabel = isAuthenticated ? "Go Home" : "Go to Login";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border bg-background/95 p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          This page could not be found.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page may have moved, or the link may be invalid.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href={homeHref} className={cn(primaryLinkClass)}>
            {homeLabel}
          </Link>
          <Link href={routes.library} className={cn(secondaryLinkClass)}>
            Open Library
          </Link>
        </div>
      </div>
    </main>
  );
}
