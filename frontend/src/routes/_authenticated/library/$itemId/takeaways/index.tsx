import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceTakeawaysPage } from "@/features/sources/pages/source-takeaways-page";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/takeaways/",
)({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceTakeawaysRoute,
});

function SourceTakeawaysRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout itemId={String(itemId)} breadcrumbPageLabel="Takeaways">
      {({ id }) => <SourceTakeawaysPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
