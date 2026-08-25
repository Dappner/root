"use client";

import { Pencil } from "lucide-react";
import { useRouter, useSearchParams } from "@/lib/nav";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileHero } from "@/features/profile/components/profile-hero";
import { ProfileSettings } from "@/features/profile/components/profile-settings";
import { ActivityTab } from "@/features/stats/components/activity-tab";
import { OverviewTab } from "@/features/stats/components/overview-tab";
import { PatternsTab } from "@/features/stats/components/patterns-tab";
import { useMyStats } from "@/features/stats/hooks";
import { useUser } from "@/lib/auth/user-provider";

const TABS = ["overview", "activity", "patterns", "settings"] as const;
type Tab = (typeof TABS)[number];

function parseTab(value: string | null): Tab {
  return TABS.includes(value as Tab) ? (value as Tab) : "overview";
}

export function ProfilePage() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const { data: stats } = useMyStats();

  const goToTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/profile?${qs}` : "/profile");
  };

  return (
    <>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[{ label: "Profile" }]} />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToTab("settings")}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </Button>
        }
      />

      <div className="container mx-auto px-4 md:px-8 py-8 space-y-8 max-w-6xl">
        <ProfileHero user={user} takeaway={stats?.takeaway_of_the_day} />

        <Tabs
          value={activeTab}
          onValueChange={(v) => goToTab(parseTab(v))}
          className="space-y-6"
        >
          <TabsList variant="line" className="border-b border-border/60 w-full justify-start rounded-none px-0">
            <TabsTrigger value="overview" className="text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-sm">
              Activity
            </TabsTrigger>
            <TabsTrigger value="patterns" className="text-sm">
              Patterns
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-sm">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab />
          </TabsContent>
          <TabsContent value="patterns">
            <PatternsTab />
          </TabsContent>
          <TabsContent value="settings">
            <ProfileSettings user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
