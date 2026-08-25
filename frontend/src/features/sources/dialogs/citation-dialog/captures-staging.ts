import type { CaptureDTO } from "@/features/captures/types";
import type { CreateCitationRequest, UpdateCitationRequest } from "../../types";
import type { StagedCapture } from "./schema";

let keyCounter = 0;

/** Stable local key for a staged capture (React keys + draft tracking). */
export function nextStagedKey(): string {
  keyCounter += 1;
  return `staged-${keyCounter}`;
}

/** Seed the staged list from a citation's existing (server) captures. */
export function seedStagedCaptures(captures: CaptureDTO[]): StagedCapture[] {
  return captures.map((c) => ({
    key: nextStagedKey(),
    id: c.id,
    text: c.text,
    originalText: c.text,
  }));
}

/** Append a non-empty draft to the staged list as a brand-new capture. */
export function stageDraft(captures: StagedCapture[], draft: string | undefined): StagedCapture[] {
  const trimmed = draft?.trim();
  if (!trimmed) return captures;
  return [...captures, { key: nextStagedKey(), text: trimmed }];
}

type CapturesDelta = NonNullable<UpdateCitationRequest["captures"]>;

/**
 * Diff the staged captures against the originals they were seeded from into the
 * backend's {create, update, delete} delta. `original` is the set of captures
 * that existed on the server when the dialog opened.
 */
export function diffCaptures(
  staged: StagedCapture[],
  original: CaptureDTO[],
): CapturesDelta {
  const create: NonNullable<CapturesDelta["create"]> = [];
  const update: NonNullable<CapturesDelta["update"]> = [];

  const stagedIds = new Set<number>();
  for (const cap of staged) {
    const text = cap.text.trim();
    if (!text) continue; // an emptied field is treated as "removed", never created
    if (cap.id == null) {
      create.push({ text });
    } else {
      stagedIds.add(cap.id);
      if (text !== (cap.originalText ?? "").trim()) {
        update.push({ id: cap.id, text });
      }
    }
  }

  const del = original.filter((c) => !stagedIds.has(c.id)).map((c) => c.id);

  return { create, update, delete: del };
}

/** Whether a delta would actually change anything on the server. */
export function deltaIsEmpty(delta: CapturesDelta): boolean {
  return (
    (delta.create?.length ?? 0) === 0 &&
    (delta.update?.length ?? 0) === 0 &&
    (delta.delete?.length ?? 0) === 0
  );
}

/** Captures to send on a citation CREATE (new citation has no originals). */
export function toCreatePayload(
  staged: StagedCapture[],
): CreateCitationRequest["captures"] {
  return staged
    .map((c) => c.text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ text }));
}
