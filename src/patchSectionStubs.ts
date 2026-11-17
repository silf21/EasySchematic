import type { ConnectionEdge, SchematicNode } from "./types";
import { STUB_GAP } from "./stubPlacement";

export interface PatchStubEnd { x: number; y: number; endX: number; endY: number; side: "left" | "right"; text: string }

/** Endpoint-attached presentation; the physical section stays a single material item. */
export function patchSectionStubEnds(
  edge: ConnectionEdge, nodes: SchematicNode[],
  source: { x: number; y: number; side: "left" | "right" },
  target: { x: number; y: number; side: "left" | "right" },
): PatchStubEnd[] {
  function endpointLabel(nodeId: string, handleId?: string | null): string {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.type === "patch-reference") {
      const panel = nodes.find(n => n.id === node.data.panelNodeId);
      const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === node.data.portId) : undefined;
      return `${panel?.data.label ?? "Panel"} [${port?.label ?? node.data.portId} · ${handleId ?? ""}]`;
    }
    const port = node?.type === "device" ? node.data.ports.find(p => p.id === handleId || `${p.id}-in` === handleId || `${p.id}-out` === handleId) : undefined;
    return `${node?.data.label ?? nodeId}${port ? ` [${port.label}]` : ""}`;
  }
  const cable = edge.data?.cableId;
  return [
    { ...source, endX: source.x + (source.side === "right" ? STUB_GAP : -STUB_GAP), endY: source.y, text: [cable, `→ ${endpointLabel(edge.target, edge.targetHandle)}`].filter(Boolean).join(" · ") },
    { ...target, endX: target.x + (target.side === "right" ? STUB_GAP : -STUB_GAP), endY: target.y, text: [cable, `→ ${endpointLabel(edge.source, edge.sourceHandle)}`].filter(Boolean).join(" · ") },
  ];
}
