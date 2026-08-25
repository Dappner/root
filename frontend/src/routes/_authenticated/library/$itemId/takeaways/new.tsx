import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NewTakeawayView } from "@/features/takeaways/components/new-takeaway-view";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/takeaways/new",
)({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: NewTakeawayRoute,
});

function NewTakeawayRoute() {
  const { itemId } = Route.useParams();

  return <NewTakeawayView sourceId={itemId} />;
}
