import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceSectionsSidebarToggle } from "@/features/sources/components/source-sections-sidebar/source-sections-sidebar";
import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceTranscriptPage } from "@/features/sources/pages/source-transcript-page";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/transcript",
)({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceTranscriptRoute,
});

function SourceTranscriptRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout
      itemId={String(itemId)}
      breadcrumbPageLabel="Transcript"
      headerActions={({ id }) => <SourceSectionsSidebarToggle sourceId={id} />}
    >
      {({ id }) => <SourceTranscriptPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
