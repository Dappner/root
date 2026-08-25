"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useGroupedHighlights } from "@/features/sources/hooks/highlights";
import { useSource } from "@/features/sources/hooks/sources";
import { CitationSelector } from "@/features/takeaways/components/citation-selector";
import {
  TakeawayForm,
  type TakeawayFormData,
} from "@/features/takeaways/components/takeaway-form";
import { useCreateTakeaway } from "@/features/takeaways/hooks";
import { plainTextToTipTapDoc } from "@/features/takeaways/utils/body-json";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { routes } from "@/lib/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "@/lib/nav";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const TakeawayFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  bodyJson: z.record(z.string(), z.unknown()),
});

interface NewTakeawayViewProps {
  sourceId: number;
}

export function NewTakeawayView({ sourceId }: NewTakeawayViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: source, isLoading } = useSource(sourceId);
  const { data: grouped } = useGroupedHighlights(sourceId);
  const createMutation = useCreateTakeaway();

  const fromCitationId = searchParams.get("fromCitationId");

  const [selectedCitationIds, setSelectedCitationIds] = useState<Set<number>>(
    new Set(fromCitationId ? [parseInt(fromCitationId)] : [])
  );

  const initialContent = useMemo(() => plainTextToTipTapDoc(""), []);

  const form = useForm<TakeawayFormData>({
    resolver: zodResolver(TakeawayFormSchema),
    defaultValues: {
      title: "",
      bodyJson: initialContent,
    },
  });

  async function onSubmit(formData: TakeawayFormData) {
    try {
      const result = await createMutation.mutateAsync({
        sourceId: sourceId,
        data: {
          title: formData.title,
          body_json: formData.bodyJson,
          citation_ids: Array.from(selectedCitationIds),
          capture_ids: [],  // intentional: new takeaways start with no capture links
        },
      });
      toast.success("Takeaway created!");
      router.push(routes.sourceTakeaway(sourceId, result.id));
    } catch (error) {
      console.error("Failed to create takeaway:", error);
      toast.error("Failed to create takeaway");
    }
  }

  const handleSelectionChange = (citationId: number, checked: boolean) => {
    const newSet = new Set(selectedCitationIds);
    if (checked) {
      newSet.add(citationId);
    } else {
      newSet.delete(citationId);
    }
    setSelectedCitationIds(newSet);
  };

  const handleMetaEnter = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Library", href: "/library" },
              {
                label: source?.title
                  ? source.title.length > 20
                    ? `${source.title.slice(0, 20)}...`
                    : source.title
                  : "...",
                href: `/library/${sourceId}`,
              },
              { label: "New Takeaway" },
            ]}
          />
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => router.push(routes.source(sourceId))}
            >
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save takeaway"
              )}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-hidden container mx-auto px-4 py-6" onKeyDown={handleMetaEnter}>
        <div className="grid grid-cols-12 gap-8 h-full">
          <div className="col-span-6 h-full overflow-y-auto pr-4">
            <TakeawayForm
              form={form}
              selectedCitationCount={selectedCitationIds.size}
              initialContent={initialContent}
              sourceId={sourceId}
            />
          </div>

          <div className="col-span-6 h-full flex flex-col overflow-hidden">
            <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground shrink-0">
              Citations from this source
            </h3>
            <div className="flex-1 overflow-y-auto pr-2">
              <CitationSelector
                sections={grouped?.sections ?? []}
                unsortedCitations={grouped?.unsorted.citations ?? []}
                selectedCitationIds={selectedCitationIds}
                onSelectionChange={handleSelectionChange}
                sourceId={sourceId}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
