export interface GraphTransformLike {
  x: number;
  y: number;
  k: number;
}

export interface Point {
  x: number;
  y: number;
}

export type DraggableNode = {
  x?: number;
  y?: number;
};

export type GraphDragSubject<TNode extends DraggableNode> = Point & {
  node: TNode;
};

export function graphToCanvasPoint(
  transform: GraphTransformLike,
  point: Point,
): Point {
  return {
    x: transform.x + point.x * transform.k,
    y: transform.y + point.y * transform.k,
  };
}

export function canvasToGraphPoint(
  transform: GraphTransformLike,
  point: Point,
): Point {
  return {
    x: (point.x - transform.x) / transform.k,
    y: (point.y - transform.y) / transform.k,
  };
}

export function createGraphDragSubject<TNode extends DraggableNode>(
  node: TNode | null,
  transform: GraphTransformLike,
): GraphDragSubject<TNode> | null {
  if (!node || node.x == null || node.y == null) return null;
  const canvasPoint = graphToCanvasPoint(transform, { x: node.x, y: node.y });
  return {
    ...canvasPoint,
    node,
  };
}

export function applyGraphDragPosition<TNode extends DraggableNode>(
  node: TNode,
  point: Point,
): void {
  node.x = point.x;
  node.y = point.y;
}
