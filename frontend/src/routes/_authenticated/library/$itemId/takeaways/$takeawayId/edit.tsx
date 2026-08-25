import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EditTakeawayView } from "@/features/takeaways/components/edit-takeaway-view";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/takeaways/$takeawayId/edit",
)({
  params: {
    parse: (p) => ({
      itemId: z.coerce.number().parse(p.itemId),
      takeawayId: z.coerce.number().parse(p.takeawayId),
    }),
  },
  component: EditTakeawayRoute,
});

function EditTakeawayRoute() {
  const { itemId, takeawayId } = Route.useParams();

  return <EditTakeawayView sourceId={itemId} takeawayId={takeawayId} />;
}
