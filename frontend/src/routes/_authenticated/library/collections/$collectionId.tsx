import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CollectionDetailPage } from "@/features/collections/pages/collection-detail-page";

export const Route = createFileRoute(
  "/_authenticated/library/collections/$collectionId",
)({
  params: {
    parse: (p) => ({ collectionId: z.coerce.number().parse(p.collectionId) }),
  },
  component: CollectionDetailRoute,
});

function CollectionDetailRoute() {
  const { collectionId } = Route.useParams();

  return <CollectionDetailPage collectionId={collectionId} />;
}
