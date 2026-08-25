import * as z from "zod";
import type { SourceType } from "@/features/sources/types";
import { getTypeConfig } from "@/features/sources/utils/metadata";

export const createSourceFormSchema = z.object({
  type: z.enum(["book", "article", "video", "podcast", "pdf"]),
  title: z.string().optional(),
  author: z.string().max(255).optional().or(z.literal("")),
  url: z.url("Invalid URL").optional().or(z.literal("")),
  published_at: z.string().optional().or(z.literal("")),
  metadata: z.record(z.string(), z.any()).optional(),
}).superRefine((data, ctx) => {
  const needsUrl = getTypeConfig(data.type as SourceType).requiresUrl;

  // URL is required for videos, articles, and podcasts
  if (needsUrl && (!data.url || data.url.trim() === "")) {
    ctx.addIssue({
      code: "custom",
      message: "URL is required for this source type",
      path: ["url"],
    });
  }

  // Title is always required before submission (will be fetched or manually entered)
  if (!data.title || data.title.trim() === "") {
    ctx.addIssue({
      code: "custom",
      message: "Title is required",
      path: ["title"],
    });
  }
});

export type CreateSourceFormData = z.infer<typeof createSourceFormSchema>;
