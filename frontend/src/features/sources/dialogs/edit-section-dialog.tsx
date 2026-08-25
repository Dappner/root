import { BaseDialogProps } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateSection } from "@/features/sources/hooks/sections";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SourceSectionDTO } from "../types";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().max(255, "Subtitle is too long").optional(),
  summary: z.string().max(1024, "Summary is too long").optional(),
  rangeStart: z.string().optional(),
  rangeEnd: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditSectionDialogProps extends BaseDialogProps {
  sourceId: number;
  section: SourceSectionDTO
}

export function EditSectionDialog({
  open,
  onOpenChange,
  sourceId,
  section,
}: EditSectionDialogProps) {
  const updateSection = useUpdateSection(sourceId, section.id);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: section.title,
      subtitle: section.subtitle ?? "",
      summary: section.summary ?? "",
      rangeStart: section.range_start?.toString() ?? "",
      rangeEnd: section.range_end?.toString() ?? "",
    },
  });

  const onSubmit = async (data: FormData) => {
    form.clearErrors(["rangeStart", "rangeEnd", "root.server" as never]);

    try {
      const start = data.rangeStart ? parseInt(data.rangeStart, 10) : null;
      const end = data.rangeEnd ? parseInt(data.rangeEnd, 10) : null;

      if (start && isNaN(start)) {
        form.setError("rangeStart", { message: "Invalid number" });
        return;
      }
      if (end && isNaN(end)) {
        form.setError("rangeEnd", { message: "Invalid number" });
        return;
      }
      if (start !== null && end !== null && end < start) {
        form.setError("rangeEnd", { message: "End must be after start" });
        return;
      }

      await updateSection.mutateAsync({
        title: data.title,
        subtitle: data.subtitle?.trim(),
        summary: data.summary?.trim(),
        range_start: start ?? undefined,
        range_end: end ?? undefined,
      });
      toast.success("Section updated");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      const message = applyAPIFormError(form, error, {
        fallbackMessage: "Failed to update section.",
      });
      toast.error(message);
    }
  };

  const handleKeyDown = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Section</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={handleKeyDown}
          className="space-y-4"
        >
          <FieldGroup>
            <Field>
              <FieldError errors={[form.formState.errors.root?.server]} />
            </Field>

            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input id="title" {...field} />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="subtitle"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="subtitle">
                    Subtitle <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </FieldLabel>
                  <Input id="subtitle" {...field} value={field.value ?? ""} />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="summary"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="summary">
                    Summary <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </FieldLabel>
                  <Textarea
                    id="summary"
                    {...field}
                    value={field.value ?? ""}
                    className="min-h-28 resize-y"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="rangeStart"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="rangeStart">Start Range</FieldLabel>
                    <Input
                      id="rangeStart"
                      type="number"
                      placeholder="e.g. 1"
                      {...field}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="rangeEnd"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="rangeEnd">End Range</FieldLabel>
                    <Input
                      id="rangeEnd"
                      type="number"
                      placeholder="e.g. 10"
                      {...field}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateSection.isPending}>
              {updateSection.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
