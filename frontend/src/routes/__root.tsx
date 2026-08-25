import { lazy, Suspense } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { DialogRenderer } from "@/components/dialogs";
import { RouteNotFound } from "@/components/layout/route-not-found";
import { VersionRefreshBanner } from "@/components/layout/version-refresh-banner";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: RouteNotFound,
});

// Dev-only; the dynamic import is dropped from production bundles.
const RouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
        default: m.TanStackRouterDevtools,
      })),
    );

function RootComponent() {
  return (
    <>
      <VersionRefreshBanner />
      <Outlet />
      {/* Global dialog system — renders the active dialog from the Zustand store */}
      <DialogRenderer />
      <Suspense>
        <RouterDevtools />
      </Suspense>
    </>
  );
}
