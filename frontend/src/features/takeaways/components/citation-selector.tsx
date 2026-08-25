import { Checkbox } from "@/components/ui/checkbox";
import type { CitationWithCapture, GroupedSection } from "@/features/sources/types";
import { formatCitationLocation } from "@/features/sources/utils/location";
import { sortCitationsByLocation } from "@/features/sources/utils/sorting";
import { TakeawayBadge } from "./takeaway-badge";
import { useMemo } from "react";

interface CitationSelectorProps {
  sections: GroupedSection[];
  unsortedCitations: CitationWithCapture[];
  selectedCitationIds: Set<number>;
  onSelectionChange: (citationId: number, checked: boolean) => void;
  /** Source ID for navigation from badge */
  sourceId: number;
}

export function CitationSelector({
  sections,
  unsortedCitations,
  selectedCitationIds,
  onSelectionChange,
  sourceId,
}: CitationSelectorProps) {
  // Sort unsorted citations by location
  const sortedUnsortedCitations = useMemo(() => {
    return [...unsortedCitations].sort(sortCitationsByLocation);
  }, [unsortedCitations]);

  const renderCitation = (cwc: CitationWithCapture) => {
    const locationLabel = formatCitationLocation(cwc.citation.location);
    const hasTakeaways = cwc.citation.takeaways && cwc.citation.takeaways.length > 0;

    return (
      <label
        key={cwc.citation.id}
        className="flex items-start gap-2 p-3 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer"
      >
        <Checkbox
          checked={selectedCitationIds.has(cwc.citation.id)}
          onCheckedChange={(checked: boolean | 'indeterminate') => {
            if (checked === 'indeterminate') return;
            onSelectionChange(cwc.citation.id, checked);
          }}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 capitalize">
              {cwc.citation.info_type}
            </span>
            {locationLabel && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono">
                {locationLabel}
              </span>
            )}
            {hasTakeaways && (
              <TakeawayBadge takeaways={cwc.citation.takeaways!} sourceId={sourceId} />
            )}
          </div>
          <p className="text-sm line-clamp-6">&ldquo;{cwc.citation.text}&rdquo;</p>
          {(cwc.citation.speaker || cwc.citation.context) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
              {cwc.citation.speaker && (
                <span className="font-medium">— {cwc.citation.speaker}</span>
              )}
              {cwc.citation.context && (
                <span className="italic">({cwc.citation.context})</span>
              )}
            </div>
          )}
        </div>
      </label>
    );
  };

  const renderSection = (section: GroupedSection, depth = 0): React.ReactNode => {
    if (section.citations.length === 0) {
      return null;
    }

    return (
      <div key={section.section.id} className={depth > 0 ? "ml-4" : ""}>
        {section.citations.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
              {section.section.title}
            </h4>
            <div className="space-y-2 mb-4">
              {section.citations.map((cwc) => renderCitation(cwc))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {sortedUnsortedCitations.length === 0 && sections.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No citations yet
        </p>
      ) : (
        <>
          {/* Unsorted citations */}
          {sortedUnsortedCitations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                Unsorted
              </h4>
              <div className="space-y-2 mb-4">
                {sortedUnsortedCitations.map((cwc) => renderCitation(cwc))}
              </div>
            </div>
          )}

          {/* Sections with citations */}
          {sections.map(section => renderSection(section))}
        </>
      )}
    </div>
  );
}
