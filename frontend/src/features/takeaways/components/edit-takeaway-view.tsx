"use client";

import { useDialog } from "@/components/dialogs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useGroupedHighlights } from "@/features/sources/hooks/highlights";
import { useSource } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { CitationSelector } from "@/features/takeaways/components/citation-selector";
import {
  TakeawayForm,
  type TakeawayFormData,
} from "@/features/takeaways/components/takeaway-form";
import { DeleteTakeawayDialog } from "@/features/takeaways/dialogs/delete-takeaway-dialog";
import {
  useTakeaway,
  useUpdateTakeaway,
} from "@/features/takeaways/hooks";
import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import { bodyJsonOrFallback } from "@/features/takeaways/utils/body-json";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { routes } from "@/lib/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSONContent } from "@tiptap/core";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const TakeawayFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  bodyJson: z.record(z.string(), z.unknown()),
});

interface EditTakeawayViewProps {
  sourceId: number;
  takeawayId: number;
}

export function EditTakeawayView({ sourceId, takeawayId }: EditTakeawayViewProps) {
  const { data: source, isLoading: sourceLoading } = useSource(sourceId);
  const { data: takeaway, isLoading: takeawayLoading } = useTakeaway(
    sourceId,
    takeawayId,
  );

  if (sourceLoading || takeawayLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!source || !takeaway) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Takeaway not found</p>
      </div>
    );
  }

  // Remount on takeaway id change so NoteEditor's seed ref captures the correct initial content.
  return (
    <EditTakeawayLoaded
      key={takeaway.id}
      sourceId={sourceId}
      takeawayId={takeawayId}
      source={source}
      takeaway={takeaway}
    />
  );
}

interface EditTakeawayLoadedProps {
  sourceId: number;
  takeawayId: number;
  source: SourceDTO;
  takeaway: SourceTakeawayDTO;
}

function EditTakeawayLoaded({
  sourceId,
  takeawayId,
  source,
  takeaway,
}: EditTakeawayLoadedProps) {
  const router = useRouter();
  const { openDialog } = useDialog();
  const { data: grouped } = useGroupedHighlights(sourceId);
  const updateMutation = useUpdateTakeaway();

  const initialContent = useMemo<JSONContent>(
    () => bodyJsonOrFallback(takeaway.body_json, takeaway.body),
    [takeaway.body_json, takeaway.body],
  );

  const [selectedCitationIds, setSelectedCitationIds] = useState<Set<number>>(
    () =>
      new Set(
        takeaway.citations
          ?.map((c) => c.id)
          .filter((id): id is number => Boolean(id)) ?? [],
      ),
  );

  const form = useForm<TakeawayFormData>({
    resolver: zodResolver(TakeawayFormSchema),
    defaultValues: {
      title: takeaway.title || "",
      bodyJson: initialContent,
    },
  });

  async function onSubmit(formData: TakeawayFormData) {
    try {
      await updateMutation.mutateAsync({
        sourceId,
        takeawayId,
        data: {
          title: formData.title,
          body_json: formData.bodyJson,
          citation_ids: Array.from(selectedCitationIds),
          // capture_ids omitted on purpose — this form has no capture UI, and the
          // server preserves existing capture links when the field is absent.
        },
      });
      toast.success("Takeaway updated!");
      router.push(routes.sourceTakeaway(sourceId, takeawayId));
    } catch (error) {
      console.error("Failed to update takeaway:", error);
      toast.error("Failed to update takeaway");
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

  const handleDeleteClick = () => {
    openDialog(DeleteTakeawayDialog, {
      sourceId,
      takeawayId,
      takeawayTitle: takeaway.title,
    });
  };

  const handleMetaEnter = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Library", href: "/library" },
              {
                label: source.title
                  ? source.title.length > 32
                    ? `${source.title.slice(0, 32)}...`
                    : source.title
                  : "...",
                href: `/library/${sourceId}`,
              },
              {
                label: takeaway.title
                  ? takeaway.title.length > 20
                    ? `${takeaway.title.slice(0, 20)}...`
                    : takeaway.title
                  : "Takeaway",
                href: `/library/${sourceId}/takeaways/${takeawayId}`,
              },
              { label: "Edit" },
            ]}
          />
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              title="Delete takeaway"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(routes.sourceTakeaway(sourceId, takeawayId))
              }
            >
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </>
        }
      />

      <div
        className="flex-1 overflow-hidden container mx-auto px-4 py-6"
        onKeyDown={handleMetaEnter}
      >
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
