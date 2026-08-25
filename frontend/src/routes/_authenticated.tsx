import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { RouteError } from "@/components/layout/route-error";
import { RoutePending } from "@/components/layout/route-pending";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PickerRenderer } from "@/components/pickers";
import { UserProvider } from "@/lib/auth/user-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { authClient, useSession } from "@/lib/auth/client";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { CommandPalette, useCommandPalette } from "@/features/command-palette";
import { AssistantPanelRenderer } from "@/features/assistant";
import { GlobalAudioElement } from "@/features/player/global-audio-element";
import { PlayerDock } from "@/features/player/player-dock";
import { PlayerHotkeys } from "@/features/player/player-hotkeys";
import { SourceSectionsSidebarHost } from "@/features/sources/components/source-sections-sidebar/source-sections-sidebar";

export const Route = createFileRoute("/_authenticated")({
  // Gate the whole authenticated tree before it renders (replaces proxy.ts
  // middleware and the old useEffect redirect — no auth flash).
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession();
    if (!data?.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
  errorComponent: RouteError,
  pendingComponent: RoutePending,
});

function AuthenticatedLayout() {
  const { data: session, isPending } = useSession();
  const isLeaderModeActive = useCommandPalette(
    (state) => state.isLeaderModeActive,
  );

  const [sidebarOpen, setSidebarOpen] = useLocalStorage("sidebar_state", true);

  const user = session?.user ?? null;

  if (isPending || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <UserProvider user={user}>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <div className="flex min-h-screen w-full">
          <AppSidebar />

          <div
            className={cn(
              "relative flex-1 flex flex-col min-w-0 transition-[box-shadow] duration-100",
              isLeaderModeActive &&
                "shadow-[inset_0_0_0_1px_rgba(134,239,172,0.28)]",
            )}
          >
            <main className="flex-1 animate-fade-in">
              <Outlet />
            </main>
          </div>
          <SourceSectionsSidebarHost />
        </div>
        <PickerRenderer />
        <AssistantPanelRenderer />
        <CommandPalette />
        <GlobalAudioElement />
        <PlayerDock />
        <PlayerHotkeys />
      </SidebarProvider>
    </UserProvider>
  );
}
