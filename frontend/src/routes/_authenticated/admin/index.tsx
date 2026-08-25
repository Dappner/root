import { createFileRoute } from "@tanstack/react-router";

import { AdminOverviewPage } from "@/features/admin/pages/admin-overview-page";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverviewPage,
});
