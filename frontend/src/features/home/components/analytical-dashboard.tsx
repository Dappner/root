"use client";

import { useUser } from "@/lib/auth/user-provider";
import { useAllNotes } from "@/features/notes/hooks";
import { useHomeData } from "../hooks";
import { AnalyticalActivityFeed } from "./analytical-activity-feed";
import { AnalyticalHeroCard } from "./analytical-hero-card";
import { AnalyticalRecentNotes } from "./analytical-recent-notes";
import { AnalyticalRecentSources } from "./analytical-recent-sources";

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function AnalyticalDashboard() {
  const user = useUser();
  const { data: homeData, isLoading: homeLoading } = useHomeData();
  const { data: allNotes = [], isLoading: notesLoading } = useAllNotes();

  const recentHighlights = homeData?.recent_highlights ?? [];
  const recentSources = homeData?.recent_sources ?? [];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Good {getTimeOfDay()}, {user.name ?? "there"}
        </h1>
        <p className="text-muted-foreground">Pick up where you left off.</p>
      </div>

      {/* Hero + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-6">
        <AnalyticalHeroCard primary={homeData?.primary} isLoading={homeLoading} />
        <AnalyticalActivityFeed highlights={recentHighlights} isLoading={homeLoading} />
      </div>

      {/* Recent Sources + Recent Notes (notes collapses when empty) */}
      {(() => {
        const hasNotes = notesLoading || allNotes.length > 0;
        return (
          <div className={`grid grid-cols-1 gap-8 ${hasNotes ? "md:grid-cols-2" : ""}`}>
            <AnalyticalRecentSources sources={recentSources} isLoading={homeLoading} />
            {hasNotes && <AnalyticalRecentNotes notes={allNotes} isLoading={notesLoading} />}
          </div>
        );
      })()}
    </div>
  );
}
