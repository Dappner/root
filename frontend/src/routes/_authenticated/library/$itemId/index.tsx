import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceSectionsSidebarToggle } from "@/features/sources/components/source-sections-sidebar/source-sections-sidebar";
import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceOverviewPage } from "@/features/sources/pages/source-overview-page";

export const Route = createFileRoute("/_authenticated/library/$itemId/")({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceOverviewRoute,
});

function SourceOverviewRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout
      itemId={String(itemId)}
      showSourceHeader
      headerActions={({ id }) => <SourceSectionsSidebarToggle sourceId={id} />}
    >
      {({ id }) => <SourceOverviewPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
