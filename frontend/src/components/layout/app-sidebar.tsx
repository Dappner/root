"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth/client";
import { clearJwt } from "@/lib/auth/jwt";
import { useUser } from "@/lib/auth/user-provider";
import { getQueryClient } from "@/lib/query-client";
import { routes } from "@/lib/routes";
import { useSource } from "@/features/sources/hooks/sources";
import { getActiveSourceRoute, getSourceRouteItems } from "@/features/sources/routes";
import type { SourceDTO } from "@/features/sources/types";
// import { clearPersistedQueryClient } from "@/lib/query-persister";
import { BookOpen, BookType, Check, ChevronDown, Home, Layers, LayoutDashboard, LogOut, Mic, Monitor, Moon, Network, NotebookPen, Sun, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, usePathname, useRouter } from "@/lib/nav";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

function getActiveSourceId(pathname: string) {
  const match = pathname.match(/^\/library\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

function SourceSidebarSection({
  pathname,
  source,
}: {
  pathname: string;
  source?: SourceDTO;
}) {
  if (!source) {
    return null;
  }

  const routeItems = getSourceRouteItems(source);
  const activeRoute = getActiveSourceRoute(pathname, source);

  return (
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <div className="px-2 py-1 text-[11px] font-medium text-sidebar-foreground/70 truncate">
          {source.title || "Untitled source"}
        </div>
      </SidebarMenuSubItem>
      {routeItems.map((item) => (
        <SidebarMenuSubItem key={item.key}>
          <SidebarMenuSubButton
            render={
              <Link href={item.href}>
                <span>{item.label}</span>
              </Link>
            }
            isActive={activeRoute === item.key}
          />
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

function SourceSidebarFlyout({
  pathname,
  source,
  children,
}: {
  pathname: string;
  source: SourceDTO;
  children: ReactElement;
}) {
  const routeItems = getSourceRouteItems(source);
  const activeRoute = getActiveSourceRoute(pathname, source);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block text-[11px] uppercase text-muted-foreground">
              Current source
            </span>
            <span
              className="mt-1 block truncate text-xs font-medium text-popover-foreground"
              title={source.title || "Untitled source"}
            >
              {source.title || "Untitled source"}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <Link href={routes.library} className="cursor-pointer">
                <BookOpen className="mr-2 h-4 w-4" />
                <span>All sources</span>
              </Link>
            }
          />
          <DropdownMenuSeparator />
          {routeItems.map((item) => (
            <DropdownMenuItem
              key={item.key}
              render={
                <Link
                  href={item.href}
                  className={cn(
                    "cursor-pointer",
                    activeRoute === item.key &&
                      "bg-accent text-accent-foreground font-medium",
                  )}
                >
                  <span>{item.label}</span>
                </Link>
              }
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const user = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const activeSourceId = getActiveSourceId(pathname);
  const { data: activeSource } = useSource(activeSourceId ?? 0);

  // Env check
  const appEnv = import.meta.env.VITE_APP_ENV || "development";
  const isProd = appEnv === "prod";

  // Get initials for avatar
  const initials = user.name
    ? user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : user.email[0].toUpperCase();

  // Display name or email as fallback
  const displayName = user.name || user.email;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out failed", error);
    } finally {
      getQueryClient().clear();
      clearJwt();
      // clearPersistedQueryClient();
    }

    router.push(routes.login);
  };

  const personalItems = [
    { title: "Home", href: "/", icon: Home },
    { title: "Library", href: "/library", icon: BookOpen },
    { title: "Collections", href: "/library/collections", icon: Layers },
    { title: "Notes", href: "/notes", icon: NotebookPen },
    { title: "Ask", href: "/ask", icon: BookType },
    { title: "Graph", href: "/graph", icon: Network },
  ];

  const discoverItems = [
    { title: "Podcasts", href: "/discover/podcasts", icon: Mic },
  ];

  const adminItems = [
    {
      title: "Overview",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Users",
      href: "/admin/users",
      icon: Users,
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3 bg-sidebar hover:bg-sidebar py-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-lg font-bold">R</span>
                </div>
                <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Root</span>
                    {!isProd && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wider border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
                        {appEnv === "development" ? "DEV" : appEnv}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">Knowledge Base</span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" &&
                    item.href !== "/library" &&
                    pathname.startsWith(item.href)) ||
                  (item.href === "/library" &&
                    pathname.startsWith("/library") &&
                    !pathname.startsWith("/library/collections"));
                const showSourceFlyout =
                  item.href === "/library" &&
                  state === "collapsed" &&
                  !isMobile &&
                  !!activeSourceId &&
                  !!activeSource;

                if (showSourceFlyout) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SourceSidebarFlyout pathname={pathname} source={activeSource}>
                        <SidebarMenuButton
                          className="cursor-pointer"
                          isActive={isActive}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SourceSidebarFlyout>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <Tooltip>
                      <TooltipTrigger render={
                        <SidebarMenuButton render={
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        } isActive={isActive}>
                        </SidebarMenuButton>
                      } />
                      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                    {item.href === "/library" && isActive && (
                      <SourceSidebarSection pathname={pathname} source={activeSource} />
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Discover</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discoverItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger render={
                        <SidebarMenuButton render={
                          <Link href={item.href}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        } isActive={isActive}>
                        </SidebarMenuButton>
                      } />
                      <TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <Tooltip>
                        <TooltipTrigger render={
                          <SidebarMenuButton render={
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          } isActive={isActive}>
                          </SidebarMenuButton>
                        } />
                        <TooltipContent
                          side="right"
                          align="center"
                          hidden={state !== "collapsed" || isMobile}
                        >
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-left text-sm group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              }>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem render={
                    <Link href={routes.profile} className="cursor-pointer">
                      <span>Profile</span>
                    </Link>
                  } />

                  <DropdownMenuItem render={
                    <Link href={`${routes.profile}?tab=activity`} className="cursor-pointer">
                      <span>Activity</span>
                    </Link>
                  } />

                  <DropdownMenuItem render={
                    <Link href={`${routes.profile}?tab=settings`} className="cursor-pointer">
                      <span>Settings</span>
                    </Link>
                  } />

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Monitor className="mr-2 h-4 w-4" />
                      <span>Theme</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={() => setTheme("light")}
                        className="cursor-pointer"
                      >
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Light</span>
                        {theme === "light" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("dark")}
                        className="cursor-pointer"
                      >
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Dark</span>
                        {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("system")}
                        className="cursor-pointer"
                      >
                        <Monitor className="mr-2 h-4 w-4" />
                        <span>System</span>
                        {theme === "system" && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
