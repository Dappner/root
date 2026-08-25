"use client";

import { Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { StaleEmbeddingsCard } from "@/features/admin/components/stale-embeddings-card";
import { useUser } from "@/features/admin/hooks/users";
import { StatsOverview } from "@/features/stats/components/stats-overview";
import { useUserStats } from "@/features/stats/hooks";
import { DEFAULT_WEEKS_BACK } from "@/features/stats/range";

interface AdminUserDetailPageProps {
  id: string;
}

export function AdminUserDetailPage({ id }: AdminUserDetailPageProps) {
  const [weeksBack, setWeeksBack] = useState<number>(DEFAULT_WEEKS_BACK);

  const { data: user, isLoading: isLoadingUser, error: userError } = useUser(id);
  const {
    data: stats,
    isLoading: isLoadingStats,
    isFetching: isFetchingStats,
    error: statsError,
  } = useUserStats(id, weeksBack);

  const breadcrumbs = [
    { label: "Admin", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: user?.email || "..." },
  ];

  return (
    <>
      <PageHeader breadcrumbs={<Breadcrumbs items={breadcrumbs} />} />
      <div className="container max-w-7xl mx-auto py-8 px-4">
        {isLoadingUser ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : userError || !user ? (
          <Empty className="py-12 rounded-xl">
            <EmptyHeader>
              <EmptyDescription className="text-destructive">
                {userError instanceof Error ? userError.message : "User not found"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
                    {user.role === "admin" && (
                      <Badge variant="default" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                    {user.banned && <Badge variant="destructive">Banned</Badge>}
                  </div>
                  <p className="text-base text-muted-foreground">{user.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {user.banned && user.banReason && (
                <div className="rounded-lg bg-destructive/10 p-4 border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    Ban Reason: {user.banReason}
                  </p>
                  {user.banExpires && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {new Date(user.banExpires).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {isLoadingStats && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {statsError && (
              <Empty className="py-12 rounded-xl">
                <EmptyHeader>
                  <EmptyDescription className="text-destructive">
                    Failed to load statistics: {(statsError as Error).message}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {stats && (
              <div className="space-y-6">
                <StatsOverview
                  stats={stats}
                  weeksBack={weeksBack}
                  onWeeksBackChange={setWeeksBack}
                  isRefetching={isFetchingStats}
                />
                <StaleEmbeddingsCard userId={id} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
