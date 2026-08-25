"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ReopenPlayerButton } from "@/features/player/components/reopen-player-button";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils/cn";
import { type ReactNode } from "react";

interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumbs, actions }: PageHeaderProps) {
  const scrolled = useScrolled();

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-[52px] md:h-[68px] items-center px-4 md:px-6 transition-all duration-200 overflow-hidden",
        scrolled && "bg-background/80 backdrop-blur-sm border-b border-border/40"
      )}
    >
      <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 md:gap-4">
        <SidebarTrigger className="cursor-pointer shrink-0" />
        {breadcrumbs && (
          <div className="min-w-0 overflow-hidden text-xs md:text-sm text-muted-foreground">
            {breadcrumbs}
          </div>
        )}
        <div className="col-start-3 flex min-w-0 items-center justify-end gap-2 overflow-hidden">
          {actions}
          <ReopenPlayerButton />
        </div>
      </div>
    </header>
  );
}
