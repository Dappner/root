import test from "node:test";
import assert from "node:assert/strict";

import {
  applyGraphDragPosition,
  canvasToGraphPoint,
  createGraphDragSubject,
  graphToCanvasPoint,
} from "@/features/graph/lib/drag-coordinates";

test("graph and canvas points round-trip through pan and zoom", () => {
  const transform = { x: 300, y: 120, k: 2 };
  const graphPoint = { x: 50, y: 40 };

  const canvasPoint = graphToCanvasPoint(transform, graphPoint);

  assert.deepEqual(canvasPoint, { x: 400, y: 200 });
  assert.deepEqual(canvasToGraphPoint(transform, canvasPoint), graphPoint);
});

test("drag subject is expressed in canvas coordinates for d3-drag", () => {
  const node = { x: 50, y: 40 };
  const transform = { x: 300, y: 120, k: 2 };

  assert.deepEqual(createGraphDragSubject(node, transform), {
    x: 400,
    y: 200,
    node,
  });
});

test("clicking off-center does not move the graph point", () => {
  const transform = { x: 300, y: 120, k: 2 };
  const node = { x: 50, y: 40 };
  const subject = createGraphDragSubject(node, transform);
  assert.ok(subject);

  const pointerDown = { x: 410, y: 194 };
  const d3Offset = {
    x: subject.x - pointerDown.x,
    y: subject.y - pointerDown.y,
  };
  const eventPointWithoutPointerMovement = {
    x: pointerDown.x + d3Offset.x,
    y: pointerDown.y + d3Offset.y,
  };

  assert.deepEqual(
    canvasToGraphPoint(transform, eventPointWithoutPointerMovement),
    node,
  );
});

test("drag deltas scale by zoom", () => {
  const transform = { x: 300, y: 120, k: 2 };
  const node = { x: 50, y: 40 };
  const subject = createGraphDragSubject(node, transform);
  assert.ok(subject);

  const pointerDown = { x: 410, y: 194 };
  const pointerMove = { x: 430, y: 184 };
  const d3Offset = {
    x: subject.x - pointerDown.x,
    y: subject.y - pointerDown.y,
  };
  const dragEventPoint = {
    x: pointerMove.x + d3Offset.x,
    y: pointerMove.y + d3Offset.y,
  };

  assert.deepEqual(canvasToGraphPoint(transform, dragEventPoint), {
    x: 60,
    y: 35,
  });
});

test("drag delta math holds across zoom levels", () => {
  const transforms = [
    { x: 0, y: 0, k: 0.5 },
    { x: 0, y: 0, k: 1 },
    { x: -80, y: 125, k: 4 },
  ];

  for (const transform of transforms) {
    const node = { x: 50, y: 40 };
    const subject = createGraphDragSubject(node, transform);
    assert.ok(subject);

    const pointerDown = {
      x: subject.x + 8,
      y: subject.y - 6,
    };
    const pointerMove = {
      x: pointerDown.x + 20,
      y: pointerDown.y - 10,
    };
    const d3Offset = {
      x: subject.x - pointerDown.x,
      y: subject.y - pointerDown.y,
    };
    const dragEventPoint = {
      x: pointerMove.x + d3Offset.x,
      y: pointerMove.y + d3Offset.y,
    };

    assert.deepEqual(canvasToGraphPoint(transform, dragEventPoint), {
      x: node.x + 20 / transform.k,
      y: node.y - 10 / transform.k,
    });
  }
});

test("drag position writes the coordinates renderers and hit-tests read", () => {
  const node = { x: 50, y: 40 };

  applyGraphDragPosition(node, { x: 60, y: 35 });

  assert.deepEqual(node, { x: 60, y: 35 });
});
