import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { AssistantSurface } from "@/features/assistant";

export const Route = createFileRoute("/_authenticated/ask")({
  component: AskRoute,
});

function AskRoute() {
  return (
    <div className="flex h-screen flex-col">
      <PageHeader breadcrumbs={<Breadcrumbs />} />
      <div className="min-h-0 flex-1">
        <AssistantSurface variant="page" context={{ surface: "ask" }} />
      </div>
    </div>
  );
}
