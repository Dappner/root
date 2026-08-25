"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Loader2, Mic, RefreshCw } from "lucide-react";
import { routes } from "@/lib/routes";
import { useRouter } from "@/lib/nav";
import { toast } from "sonner";
import { usePodcastShow, useSyncPodcastShow } from "../hooks";

interface PodcastShowHeaderProps {
  slug: string;
}

export function PodcastShowHeader({ slug }: PodcastShowHeaderProps) {
  const router = useRouter();
  const { data: show, isPending } = usePodcastShow(slug);
  const syncShow = useSyncPodcastShow();

  const handleSync = async () => {
    try {
      if (!show?.slug) {
        toast.error("Show data missing");
        return;
      }
      await syncShow.mutateAsync(show.slug);
      toast.success("Sync started — new episodes will appear shortly");
    } catch {
      toast.error("Failed to sync show");
    }
  };

  // Loading state
  if (isPending) {
    return (
      <div className="space-y-8">
        <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Podcasts", href: "/discover/podcasts" }, { label: "Loading..." }]} />} />
        <div className="container mx-auto px-4 md:px-8 space-y-8">
          <div className="flex gap-8 items-start">
            <Skeleton className="w-48 h-48 rounded-xl" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-20 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!show) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Show not found</h2>
        <Button variant="link" onClick={() => router.push(routes.discoverPodcasts)}>Back to Discover</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={[
          { label: "Podcasts", href: "/discover/podcasts" },
          { label: show.title || "Show" }
        ]} />}
      />
      <div className="container mx-auto px-4 md:px-8 pt-4 pb-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-48 h-48 flex-shrink-0 relative overflow-hidden rounded-xl border">
            {show.image_url ? (
              <img
                src={show.image_url}
                alt={show.title}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary">
                <Mic className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{show.title}</h1>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncShow.isPending}
              >
                {syncShow.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync RSS
              </Button>
            </div>
            <p className="text-muted-foreground max-w-3xl line-clamp-3 md:line-clamp-none">
              {show.description}
            </p>
            {show.categories && show.categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {show.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-4 text-sm text-muted-foreground">
              {show.language && <span>Language: {show.language.toUpperCase()}</span>}
              {show.explicit && <span className="text-red-500 font-bold">EXPLICIT</span>}
              {show.last_synced_at && (
                <span>Last synced: {format(new Date(show.last_synced_at), "MMM d, yyyy")}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
