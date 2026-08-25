import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { SectionsBackfillCard } from "@/features/admin/components/sections-backfill-card";
import { TranscriptEmbedCard } from "@/features/admin/components/transcript-embed-card";

export function AdminOverviewPage() {
  return (
    <>
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Admin" }]} />} />
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Admin Overview</h1>
          <div className="grid gap-6 md:grid-cols-2">
            <TranscriptEmbedCard />
            <SectionsBackfillCard />
          </div>
        </div>
      </div>
    </>
  );
}
