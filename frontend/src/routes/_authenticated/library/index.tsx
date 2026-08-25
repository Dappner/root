import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LibraryPage } from "@/features/sources/pages/library-page";

export const Route = createFileRoute("/_authenticated/library/")({
  validateSearch: z.object({
    type: z.string().optional(),
    status: z.string().optional(),
  }),
  component: LibraryPage,
});
