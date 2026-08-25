import test from "node:test";
import assert from "node:assert/strict";
import { zoomIdentity } from "d3-zoom";

import type { SimNode } from "@/features/graph/lib/edge-kinds";
import { pickNode } from "@/features/graph/lib/hit-test";

test("pickNode uses the full visible hit radius for large source rings", () => {
  const sourceNode: SimNode = {
    id: "source:1",
    x: 100,
    y: 100,
    node: {
      kind: "source",
      id: "source:1",
      source_id: 1,
      title: "Large source",
      childCount: 24,
    },
  };

  assert.equal(
    pickNode([sourceNode], zoomIdentity, 124, 100),
    sourceNode,
  );
});
