import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PodcastEpisodesList } from "@/features/podcasts/components/podcast-episodes-list";
import { PodcastShowHeader } from "@/features/podcasts/components/podcast-show-header";

export const Route = createFileRoute("/_authenticated/discover/podcasts/$slug")({
  params: {
    parse: (p) => ({ slug: z.string().parse(p.slug) }),
  },
  component: PodcastShowRoute,
});

function PodcastShowRoute() {
  const { slug } = Route.useParams();

  return (
    <>
      <PodcastShowHeader slug={slug} />
      <PodcastEpisodesList slug={slug} />
    </>
  );
}
