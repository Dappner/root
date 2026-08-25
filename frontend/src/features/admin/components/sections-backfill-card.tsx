"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  useBackfillCitationSections,
  useBackfillSections,
} from "@/features/podcasts/transcript-hooks";
import { ListTree, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SectionsBackfillCard() {
  const [force, setForce] = useState(false);
  const backfillSections = useBackfillSections();
  const backfillCitations = useBackfillCitationSections();

  const handleGenerateSections = async () => {
    try {
      const result = await backfillSections.mutateAsync({ force });
      toast.success(
        `Queued ${result.queued} episode${result.queued === 1 ? "" : "s"} (skipped ${result.skipped})`,
      );
    } catch {
      toast.error("Failed to queue section backfill");
    }
  };

  const handleAssignCitations = async () => {
    try {
      const result = await backfillCitations.mutateAsync();
      toast.success(
        `Updated ${result.citations_updated} citation${result.citations_updated === 1 ? "" : "s"} and ${result.captures_updated} capture${result.captures_updated === 1 ? "" : "s"}`,
      );
    } catch {
      toast.error("Failed to assign citations to sections");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          Source Sections Backfill
        </CardTitle>
        <CardDescription>
          Generate auto-sections for transcribed podcasts and sort citations/captures into
          matching sections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">1. Generate sections</p>
            <p className="text-xs text-muted-foreground">
              Runs the auto-sectioner on every transcribed podcast missing sections.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sections-backfill-force"
              checked={force}
              onCheckedChange={(checked) => setForce(checked === true)}
            />
            <Label htmlFor="sections-backfill-force" className="text-sm font-normal">
              Force re-section episodes that already have auto sections
            </Label>
          </div>
          <Button onClick={handleGenerateSections} disabled={backfillSections.isPending}>
            {backfillSections.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Queuing…
              </>
            ) : (
              "Generate sections"
            )}
          </Button>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">2. Assign citations to sections</p>
            <p className="text-xs text-muted-foreground">
              Matches AV citations by start timestamp and book citations by page range. Captures
              inherit from their linked citation. Idempotent — safe to re-run.
            </p>
          </div>
          <Button
            onClick={handleAssignCitations}
            disabled={backfillCitations.isPending}
            variant="outline"
          >
            {backfillCitations.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                Assigning…
              </>
            ) : (
              "Assign citations"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
