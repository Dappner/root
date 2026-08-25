import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { useSource } from "@/features/sources/hooks/sources";
import { SectionDetailPage } from "@/features/sources/pages/section-detail-page";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/sections/$sectionId",
)({
  params: {
    parse: (p) => ({
      itemId: z.coerce.number().parse(p.itemId),
      sectionId: z.string().parse(p.sectionId),
    }),
  },
  component: SectionDetailRoute,
});

function SectionDetailRoute() {
  const { itemId, sectionId } = Route.useParams();
  const { data: source, isLoading } = useSource(itemId);

  if (isLoading || !source) {
    return (
      <div className="container mx-auto px-4 pt-4 pb-8 flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SectionDetailPage source={source} sourceId={itemId} sectionId={sectionId} />
  );
}
