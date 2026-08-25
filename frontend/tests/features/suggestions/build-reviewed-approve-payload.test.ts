import test from "node:test";
import assert from "node:assert/strict";

import { buildReviewedApprovePayload, type ReviewedItemDraft } from "@/features/suggestions/utils";
import type {
  SuggestedPayloadEntitiesOutput,
  SuggestionResponse,
  TranscriptLocation,
} from "@/features/suggestions/types";

/** Minimal transcript location so a citation is well-formed. */
function loc(tStartSec: number, tEndSec: number): TranscriptLocation {
  return {
    mode: "derived",
    type: "transcript_v1",
    transcript: {
      utteranceStartIdx: 0,
      utteranceEndIdx: 0,
      charOffsetStart: 0,
      charOffsetEnd: 0,
      tStartSec,
      tEndSec,
    },
  };
}

/** Build a `ready` suggestion carrying the given create_entities payload. */
function makeSuggestion(
  entities: Partial<SuggestedPayloadEntitiesOutput>,
): SuggestionResponse {
  const payload: SuggestedPayloadEntitiesOutput = {
    action: "create_entities",
    confidence: 0.9,
    voice_transcript: "vt",
    reasoning_summary: "rs",
    citations: [],
    captures: [],
    ...entities,
  };
  return {
    id: 1,
    user_id: "u1",
    source_id: 10,
    origin: "mobile_voice",
    status: "ready",
    suggested_payload: payload,
    processing_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as SuggestionResponse;
}

/** Convenience: the create_entities payload after a build, narrowed. */
function entitiesOf(
  result: ReturnType<typeof buildReviewedApprovePayload>,
): SuggestedPayloadEntitiesOutput {
  assert.ok(result && typeof result === "object" && "action" in result);
  assert.equal((result as SuggestedPayloadEntitiesOutput).action, "create_entities");
  return result as SuggestedPayloadEntitiesOutput;
}

test("edits citation and capture text", () => {
  const suggestion = makeSuggestion({
    citations: [{ text: "orig quote", info_type: "claim", location: loc(1, 2) }],
    captures: [{ text: "orig comment", citation_idx: 0 }],
  });
  const items: ReviewedItemDraft[] = [
    { kind: "citation", index: 0, editedText: "edited quote", dismissed: false },
    { kind: "capture", index: 0, editedText: "edited comment", dismissed: false },
  ];

  const out = entitiesOf(buildReviewedApprovePayload(suggestion, items));
  assert.equal(out.citations.length, 1);
  assert.equal(out.citations[0].text, "edited quote");
  assert.equal(out.captures.length, 1);
  assert.equal(out.captures[0].text, "edited comment");
  assert.equal(out.captures[0].citation_idx, 0);
});

test("dismissing a citation drops it and relinks its tied capture to standalone", () => {
  const suggestion = makeSuggestion({
    citations: [
      { text: "c0", info_type: "claim", location: loc(1, 2) },
      { text: "c1", info_type: "claim", location: loc(3, 4) },
    ],
    captures: [{ text: "comment on c0", citation_idx: 0 }],
  });
  const items: ReviewedItemDraft[] = [
    { kind: "citation", index: 0, editedText: "c0", dismissed: true },
    { kind: "citation", index: 1, editedText: "c1", dismissed: false },
    { kind: "capture", index: 0, editedText: "comment on c0", dismissed: false },
  ];

  const out = entitiesOf(buildReviewedApprovePayload(suggestion, items));
  // Only c1 survives as a citation, remapped to index 0.
  assert.equal(out.citations.length, 1);
  assert.equal(out.citations[0].text, "c1");
  // The capture survives but its tie (to the dismissed c0) is cleared.
  assert.equal(out.captures.length, 1);
  assert.equal(out.captures[0].text, "comment on c0");
  assert.equal(out.captures[0].citation_idx, undefined);
});

test("a surviving capture keeps its tie to a surviving citation", () => {
  const suggestion = makeSuggestion({
    citations: [{ text: "c0", info_type: "claim", location: loc(1, 2) }],
    captures: [{ text: "tied comment", citation_idx: 0 }],
  });
  const items: ReviewedItemDraft[] = [
    { kind: "citation", index: 0, editedText: "c0", dismissed: false },
    { kind: "capture", index: 0, editedText: "tied comment", dismissed: false },
  ];

  const out = entitiesOf(buildReviewedApprovePayload(suggestion, items));
  assert.equal(out.citations.length, 1);
  assert.equal(out.captures.length, 1);
  assert.equal(out.captures[0].citation_idx, 0);
});

test("dismissing every item yields empty citations and captures", () => {
  const suggestion = makeSuggestion({
    citations: [{ text: "c0", info_type: "claim", location: loc(1, 2) }],
    captures: [{ text: "cap0", citation_idx: 0 }],
  });
  const items: ReviewedItemDraft[] = [
    { kind: "citation", index: 0, editedText: "c0", dismissed: true },
    { kind: "capture", index: 0, editedText: "cap0", dismissed: true },
  ];

  const out = entitiesOf(buildReviewedApprovePayload(suggestion, items));
  assert.equal(out.citations.length, 0);
  assert.equal(out.captures.length, 0);
});
