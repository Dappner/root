import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { z } from "zod";

import { GraphView } from "@/features/graph/components/graph-view";

export const Route = createFileRoute("/_authenticated/graph")({
  // `node` ("kind:id") drives the selected-node URL state; the graph reads it
  // via the nav shim's useSearchParams. Declared so TanStack retains it.
  validateSearch: z.object({
    node: z.string().optional(),
  }),
  component: GraphRoute,
});

// The graph view is the page — no breadcrumb header, no chrome. The graph's
// own floating toolbar acts as the route's UI.
function GraphRoute() {
  return (
    <div className="absolute inset-0">
      <Suspense>
        <GraphView />
      </Suspense>
    </div>
  );
}
