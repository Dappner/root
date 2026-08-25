import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SuggestionsPage } from "@/features/suggestions/pages/suggestions-page";

export const Route = createFileRoute("/_authenticated/suggestions/")({
  // Filter / sort seed local state from the URL and are mirrored back; read via
  // the nav shim's useSearchParams. Declared so TanStack retains them.
  validateSearch: z.object({
    filter: z.string().optional(),
    sort: z.string().optional(),
  }),
  component: SuggestionsPage,
});
