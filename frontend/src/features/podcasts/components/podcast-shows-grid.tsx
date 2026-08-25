"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, Search } from "lucide-react";
import { Link } from "@/lib/nav";
import { useState } from "react";
import { usePodcastShows } from "../hooks";

export function PodcastShowsGrid() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: response, isPending } = usePodcastShows();

  const shows = response?.data ?? [];
  const filteredShows = shows.filter(show =>
    (show.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (show.author || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search shows..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Loading State */}
      {isPending && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Shows Grid */}
      {!isPending && filteredShows && filteredShows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredShows.map((show) => (
            <Link
              key={show.rss_feed_url}
              href={`/discover/podcasts/${show.slug}`}
              className="group"
            >
              <div className="space-y-3">
                <div className="aspect-square relative overflow-hidden rounded-xl border bg-secondary transition-all group-hover:shadow-lg group-hover:scale-[1.02]">
                  {show.image_url ? (
                    <img
                      src={show.image_url}
                      alt={show.title}
                      className="object-cover w-full h-full transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Mic className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 px-1">
                  <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {show.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isPending && (!filteredShows || filteredShows.length === 0) && (
        <Empty className="py-16 rounded-xl">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Mic className="size-5" />
            </EmptyMedia>
            <EmptyTitle>
              {searchQuery ? "No shows found" : "No syndicated shows yet"}
            </EmptyTitle>
            <EmptyDescription className="max-w-sm mx-auto">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Add a show using an Apple Podcasts URL to get started"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
