import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PodcastsPage } from "@/features/podcasts/pages/podcasts-page";

export const Route = createFileRoute("/_authenticated/discover/podcasts/")({
  // `view` toggles browse/library; read via the nav shim's useSearchParams.
  validateSearch: z.object({
    view: z.string().optional(),
  }),
  component: PodcastsPage,
});
