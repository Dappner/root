import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceNotesPage } from "@/features/sources/pages/source-notes-page";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/notes/",
)({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceNotesRoute,
});

function SourceNotesRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout itemId={String(itemId)} breadcrumbPageLabel="Notes">
      {({ id }) => <SourceNotesPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
