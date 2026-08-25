import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { TakeawayDetailView } from "@/features/takeaways/components/takeaway-detail-view";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/takeaways/$takeawayId/",
)({
  params: {
    parse: (p) => ({
      itemId: z.coerce.number().parse(p.itemId),
      takeawayId: z.coerce.number().parse(p.takeawayId),
    }),
  },
  component: TakeawayDetailRoute,
});

function TakeawayDetailRoute() {
  const { itemId, takeawayId } = Route.useParams();

  return <TakeawayDetailView sourceId={itemId} takeawayId={takeawayId} />;
}
