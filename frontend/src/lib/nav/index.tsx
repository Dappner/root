/**
 * Navigation facade over TanStack Router.
 *
 * Exposes a small, stable navigation surface (`useRouter().push/replace/refresh`,
 * `usePathname`, `useSearchParams`, `useParams`, `<Link href>`) that the app's
 * feature code imports instead of reaching into `@tanstack/react-router`
 * directly. Paths flow through `routes.ts` as plain strings and are passed to
 * TanStack as untyped string `to`; typed `to`/`params`/`validateSearch` live in
 * the route files.
 *
 * (Originally a dual-stack Next↔TanStack shim during the migration; collapsed to
 * TanStack-only at cutover. Kept as a facade so call sites stay decoupled from
 * the router library.)
 */
import {
  Link as TanStackLink,
  useNavigate,
  useLocation,
  useParams as useTanStackParams,
  useRouter as useTanStackRouter,
} from "@tanstack/react-router";

import type { AppRouter, LinkProps } from "./types";

export type { AppRouter, LinkProps } from "./types";

export function useRouter(): AppRouter {
  const navigate = useNavigate();
  const router = useTanStackRouter();
  return {
    push: (href) => void navigate({ to: href }),
    replace: (href) => void navigate({ to: href, replace: true }),
    // No SSR/RSC; React Query owns data freshness. `refresh()` maps to a router
    // invalidate so any loader-derived state re-runs.
    refresh: () => void router.invalidate(),
    back: () => router.history.back(),
  };
}

export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname });
}

/**
 * Returns a `URLSearchParams` reader (`.get(key)` / `.toString()`) rebuilt from
 * the raw search string, matching the slice of the API the app uses.
 */
export function useSearchParams(): URLSearchParams {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  return new URLSearchParams(searchStr);
}

export function useParams<T extends Record<string, string>>(): T {
  return useTanStackParams({ strict: false }) as unknown as T;
}

export function Link({ href, children, ...rest }: LinkProps) {
  // TanStack preloads on intent via router config; the legacy `prefetch` prop
  // has no per-link equivalent, so it is dropped here.
  delete (rest as { prefetch?: boolean }).prefetch;
  return (
    <TanStackLink to={href} {...rest}>
      {children}
    </TanStackLink>
  );
}
