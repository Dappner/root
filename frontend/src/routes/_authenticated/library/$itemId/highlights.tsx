import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceSectionsSidebarToggle } from "@/features/sources/components/source-sections-sidebar/source-sections-sidebar";
import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceHighlightsPage } from "@/features/sources/pages/source-highlights-page";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/highlights",
)({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceHighlightsRoute,
});

function SourceHighlightsRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout
      itemId={String(itemId)}
      breadcrumbPageLabel="Highlights"
      headerActions={({ id }) => (
        <>
          <SourceHighlightsPage.CreateButton sourceId={id} />
          <SourceSectionsSidebarToggle sourceId={id} />
        </>
      )}
    >
      {({ id }) => <SourceHighlightsPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
