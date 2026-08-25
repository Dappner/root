import { createFileRoute } from "@tanstack/react-router";

import { CollectionsPage } from "@/features/collections/pages/collections-page";

export const Route = createFileRoute("/_authenticated/library/collections/")({
  component: CollectionsPage,
});
