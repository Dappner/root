import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticalDashboard } from "@/features/home/components/analytical-dashboard";
import { GreetingSection } from "@/features/home/components/greeting-section";
import { InProgressStrip } from "@/features/home/components/in-progress-strip";
import { PrimaryFocusCard } from "@/features/home/components/primary-focus-card";
import { useHomeData } from "@/features/home/hooks";
import { useDashboardMode } from "@/features/home/preferences";
import { SuggestionsHeaderPill } from "@/features/suggestions/components/suggestions-header-pill";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { data: homeData, isLoading } = useHomeData();
  const [dashboardMode] = useDashboardMode();

  return (
    <>
      <PageHeader
        breadcrumbs={<Breadcrumbs />}
        actions={<SuggestionsHeaderPill />}
      />

      {dashboardMode === "analytical" ? (
        <div className="px-4 md:px-8 pt-4 pb-8">
          <AnalyticalDashboard />
        </div>
      ) : (
        <div className="container mx-auto px-4 md:px-8 pt-4 pb-8 space-y-8">
          <GreetingSection />
          <PrimaryFocusCard primary={homeData?.primary} isLoading={isLoading} />
          <InProgressStrip sources={homeData?.recent_sources ?? []} />
        </div>
      )}
    </>
  );
}
