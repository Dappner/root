import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SourceRouteLayout } from "@/features/sources/pages/source-route-layout";
import { SourceReflectPage } from "@/features/sources/pages/source-reflect-page";

export const Route = createFileRoute("/_authenticated/library/$itemId/reflect")({
  params: {
    parse: (p) => ({ itemId: z.coerce.number().parse(p.itemId) }),
  },
  component: SourceReflectRoute,
});

function SourceReflectRoute() {
  const { itemId } = Route.useParams();

  return (
    <SourceRouteLayout
      itemId={String(itemId)}
      breadcrumbPageLabel="Reflect"
      showScrollToTop={false}
      showMediaDock={false}
    >
      {({ id }) => <SourceReflectPage sourceId={id} />}
    </SourceRouteLayout>
  );
}
