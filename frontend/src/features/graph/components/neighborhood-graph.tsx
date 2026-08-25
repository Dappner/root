"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useNeighborhood } from "@/features/graph/hooks/queries";
import { colorForSource } from "@/features/graph/lib/colors";
import { runForceLayout } from "@/features/graph/lib/layout";
import type {
  GraphEdgeDTO,
  GraphNodeDTO,
  NodeNeighborhoodDTO,
} from "@/features/graph/types";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { routes } from "@/lib/routes";
import { ArrowUpRight, Network } from "lucide-react";
import { useTheme } from "next-themes";
import { Link, useRouter } from "@/lib/nav";
import { useMemo, useState } from "react";

interface NeighborhoodGraphProps {
  centerId: string;
}

// Two node sizes — entity cards (takeaway/note) are full-size, citation dots
// are small connector pivots. Collision radius keys off the larger size to
// avoid the two from overlapping.
const ENTITY_WIDTH = 150;
const ENTITY_HEIGHT = 56;
const CITATION_RADIUS = 7;
const ENTITY_COLLIDE =
  Math.sqrt(ENTITY_WIDTH * ENTITY_WIDTH + ENTITY_HEIGHT * ENTITY_HEIGHT) / 2 + 8;

interface EntityNodeData extends Record<string, unknown> {
  node: GraphNodeDTO;
  isCenter: boolean;
}

interface CitationNodeData extends Record<string, unknown> {
  node: GraphNodeDTO;
  // Single setter for hover / focus / click — whichever fires last wins.
  // Passing null clears. This keeps citation discoverability honest across
  // mouse, touch, and keyboard input modes.
  onShow: (node: GraphNodeDTO | null) => void;
}

function EntityNode({ data }: NodeProps<Node<EntityNodeData>>) {
  const { node, isCenter } = data;
  const color = colorForSource(node.source_id);

  // Notes share the same color axis (source) as takeaways; what changes is
  // the border treatment, so kind reads visually without recoloring.
  const isNote = node.kind === "note";

  return (
    <div
      className="rounded-md border bg-card shadow-sm px-2 py-1.5 text-left transition-transform hover:scale-[1.03]"
      style={{
        width: ENTITY_WIDTH,
        borderLeftColor: color,
        borderLeftWidth: 3,
        borderColor: isCenter ? color : undefined,
        borderWidth: isCenter ? 2 : 1,
        borderStyle: isNote ? "dashed" : "solid",
      }}
      title={node.title}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <div className="text-[10px] font-medium leading-tight line-clamp-2">
        {node.title}
      </div>
    </div>
  );
}

function CitationDot({ data }: NodeProps<Node<CitationNodeData>>) {
  const { node, onShow } = data;
  const color = colorForSource(node.source_id);
  const label = node.text
    ? `Citation: ${node.text.slice(0, 80)}`
    : "Citation";
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-full border-2 cursor-pointer transition-transform hover:scale-125 focus:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        width: CITATION_RADIUS * 2,
        height: CITATION_RADIUS * 2,
        backgroundColor: color,
        borderColor: "var(--color-card)",
        padding: 0,
      }}
      onMouseEnter={() => onShow(node)}
      onMouseLeave={() => onShow(null)}
      onFocus={() => onShow(node)}
      onBlur={() => onShow(null)}
      onClick={(e) => {
        e.stopPropagation();
        onShow(node);
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0 !w-0 !h-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0 !w-0 !h-0"
      />
    </button>
  );
}

const nodeTypes = { entity: EntityNode, citation: CitationDot };

/**
 * Build the React Flow node + edge inputs from the neighborhood response.
 * Two node types coexist:
 *  - entity: center + every connection (takeaways and notes)
 *  - citation: each pivot dot
 * Edges fan center → each citation → each connected entity sharing it.
 */
function buildGraph(
  neighborhood: NodeNeighborhoodDTO,
): { nodes: GraphNodeDTO[]; edges: GraphEdgeDTO[] } {
  const nodes: GraphNodeDTO[] = [
    neighborhood.center,
    ...neighborhood.citations,
    ...neighborhood.connections.map((c) => c.node),
  ];

  const edges: GraphEdgeDTO[] = [];
  // Center → each citation. Only when the center has pivots (takeaway/note
  // centers); for a citation center the citations list is empty.
  for (const citation of neighborhood.citations) {
    edges.push({
      source: neighborhood.center.id,
      target: citation.id,
      edge_type: "structural",
    });
  }
  // Each connection → every citation it shares with the center. Multi-edges
  // are intentional: a connection sharing two citations gets two strands,
  // visually reading as "tightly bound."
  for (const conn of neighborhood.connections) {
    for (const cid of conn.via_citation_ids) {
      edges.push({
        source: `citation:${cid}`,
        target: conn.node.id,
        edge_type: "structural",
      });
    }
  }
  // Special case: citation-as-center. The center has no separate "citations"
  // list, so wire connections directly to the center.
  if (
    neighborhood.center.kind === "citation" &&
    neighborhood.citations.length === 0
  ) {
    for (const conn of neighborhood.connections) {
      edges.push({
        source: neighborhood.center.id,
        target: conn.node.id,
        edge_type: "structural",
      });
    }
  }

  return { nodes, edges };
}

export function NeighborhoodGraph({ centerId }: NeighborhoodGraphProps) {
  const router = useRouter();
  const { data, isPending } = useNeighborhood(centerId);
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "dark" ? "dark" : "light";
  // Single "what citation should the popover show" — driven by hover, focus,
  // or click on a dot. Whichever input mode the user has, one popover slot
  // covers it.
  const [activeCitation, setActiveCitation] = useState<GraphNodeDTO | null>(
    null,
  );

  const graph = useMemo(() => (data ? buildGraph(data) : null), [data]);

  const laidOut = useMemo(
    () =>
      runForceLayout(graph?.nodes ?? [], graph?.edges ?? [], {
        // Citation dots are tiny; use the entity collide radius as the
        // bound. Dots placed under cards is fine; the visual order keeps
        // cards on top.
        collideRadius: ENTITY_COLLIDE,
        baseLinkDistance: 110,
        chargeStrength: -400,
        ticks: 400,
        pinnedNodeId: centerId,
      }),
    [graph, centerId],
  );

  const flowNodes = useMemo<Node<EntityNodeData | CitationNodeData>[]>(() => {
    return laidOut.map((n) => {
      const isCenter = n.id === centerId;
      // d3-force positions nodes by center; React Flow's `position` is the
      // node's top-left. Offset by half the rendered size so simulation
      // spacing (link rest length, collide radius) matches on-screen geometry.
      if (n.kind === "citation") {
        return {
          id: n.id,
          type: "citation",
          position: { x: n.x - CITATION_RADIUS, y: n.y - CITATION_RADIUS },
          data: { node: n, onShow: setActiveCitation },
          width: CITATION_RADIUS * 2,
          height: CITATION_RADIUS * 2,
        };
      }
      return {
        id: n.id,
        type: "entity",
        position: { x: n.x - ENTITY_WIDTH / 2, y: n.y - ENTITY_HEIGHT / 2 },
        data: { node: n, isCenter },
        width: ENTITY_WIDTH,
        height: ENTITY_HEIGHT,
      };
    });
  }, [laidOut, centerId]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!graph) return [];
    return graph.edges.map((e, i) => ({
      id: `${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      style: {
        stroke: "var(--color-foreground)",
        strokeWidth: 1.5,
        opacity: 0.7,
      },
    }));
  }, [graph]);

  if (isPending) {
    return (
      <section className="space-y-3">
        <SectionHeader />
        <Skeleton className="h-[220px] w-full rounded-md" />
      </section>
    );
  }

  // No data, or center with zero citations AND zero connections: silent. The
  // parallels panel below carries the "nothing to show" story verbally.
  if (
    !data ||
    (data.citations.length === 0 && data.connections.length === 0)
  ) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionHeader />
      <div className="relative h-[220px] w-full rounded-md border bg-muted/20 overflow-hidden">
        <ReactFlow
          colorMode={colorMode}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            const nodeData = node.data as EntityNodeData | CitationNodeData;
            const entity = nodeData.node;
            if (entity.id === centerId) return;
            if (entity.kind === "takeaway" && entity.source_id != null) {
              router.push(
                `/library/${entity.source_id}/takeaways/${entity.entity_id}`,
              );
            } else if (entity.kind === "note") {
              router.push(routes.note(entity.entity_id));
            }
          }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={1.5}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
        {activeCitation && <CitationPopover node={activeCitation} />}
      </div>
    </section>
  );
}

function CitationPopover({ node }: { node: GraphNodeDTO }) {
  return (
    <div className="absolute bottom-2 left-2 right-2 pointer-events-none rounded-md border bg-popover px-3 py-2 shadow-lg text-xs space-y-1">
      {node.source_title && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {node.source_title}
        </div>
      )}
      <div className="text-foreground italic line-clamp-3">
        &ldquo;{node.text}&rdquo;
      </div>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
        <Network className="w-4 h-4" />
        Neighborhood
      </h3>
      <Link
        href={routes.graph}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
      >
        Full graph
        <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
