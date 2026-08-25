import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoteEditor } from "@/features/notes/components/note-editor";
import type { JSONContent } from "@tiptap/core";
import type { UseFormReturn } from "react-hook-form";

export interface TakeawayFormData {
  title: string;
  bodyJson: JSONContent;
}

interface TakeawayFormProps {
  form: UseFormReturn<TakeawayFormData>;
  selectedCitationCount: number;
  initialContent: JSONContent;
  sourceId: number;
}

export function TakeawayForm({
  form,
  selectedCitationCount,
  initialContent,
  sourceId,
}: TakeawayFormProps) {
  return (
    <form className="space-y-6">
      <div>
        <Label htmlFor="title" className="text-base">
          Title
        </Label>
        <Input
          id="title"
          placeholder="e.g., Build for 10x first; redesign later"
          {...form.register("title")}
          className="text-lg font-semibold mt-2"
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Max 255 characters
        </p>
      </div>

      <div>
        <Label className="text-base">Body</Label>
        <div className="mt-2 rounded-md border border-input bg-background px-3 py-2 min-h-[300px]">
          <NoteEditor
            initialContent={initialContent}
            sourceId={sourceId}
            onBodyChange={({ body }) => {
              form.setValue("bodyJson", body as JSONContent, {
                shouldDirty: true,
              });
            }}
          />
        </div>
      </div>

      {/* Selection summary */}
      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Selected:</span>{" "}
          {selectedCitationCount} citation
          {selectedCitationCount !== 1 ? "s" : ""}
        </p>
      </div>
    </form>
  );
}
