import type { BaseDialogProps } from "@/components/dialogs";
import type { CitationDTO } from "@/features/sources/types";
import type { CitationLocation } from "@/features/sources/utils/location";

/**
 * Citation Dialog Props - Discriminated Union
 *
 * 4 variants based on mode × flow:
 * - DerivedCreate: Quote from transcript/PDF (text/location read-only)
 * - DerivedUpdate: Edit derived citation (text/location read-only)
 * - ManualCreate: Manual citation entry (all fields editable)
 * - ManualUpdate: Edit manual citation (all fields editable)
 */

export interface DerivedCreateProps extends BaseDialogProps {
  mode: "create";
  flow: "derived";
  sourceId: number;
  quoteText: string;
  location: CitationLocation;
  suggestionId?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}

export interface DerivedUpdateProps extends BaseDialogProps {
  mode: "update";
  flow: "derived";
  citation: CitationDTO;
  sourceId?: number;
}

export interface ManualCreateProps extends BaseDialogProps {
  mode: "create";
  flow: "manual";
  sourceId: number;
  sectionId?: number;
  sectionTitle?: string;
  initialQuote?: string;
  initialTimestamp?: number;
  initialPageStart?: number;
  initialPageEnd?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}

export interface ManualUpdateProps extends BaseDialogProps {
  mode: "update";
  flow: "manual";
  citation: CitationDTO;
  sourceId?: number;
}

export type CitationDialogProps =
  | DerivedCreateProps
  | DerivedUpdateProps
  | ManualCreateProps
  | ManualUpdateProps;

export type ManualProps = ManualCreateProps | ManualUpdateProps;
export type DerivedProps = DerivedCreateProps | DerivedUpdateProps;

export function isManualProps(props: CitationDialogProps): props is ManualProps {
  return props.flow === "manual";
}

export function isDerivedProps(props: CitationDialogProps): props is DerivedProps {
  return props.flow === "derived";
}
