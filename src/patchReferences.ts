import { GRID_SIZE } from "./gridConstants";
import type { ConnectionEdge, PatchReferenceNode, SchematicNode } from "./types";
import { entryFace, exitFace, resolvableHops, segmentsForEdge } from "./patchCircuits";

export const PATCH_REFERENCE_WIDTH = 144;
export const PATCH_REFERENCE_HEIGHT = 64;
export const PATCH_REFERENCE_HANDLE_Y = 48;
export function patchReferenceId(edgeId: string, panelId: string, portId: string): string {
  return `patch-ref:${encodeURIComponent(edgeId)}:${encodeURIComponent(panelId)}:${encodeURIComponent(portId)}`;
}

/** Keep diagram references in sync, retaining their positions while the compact view is active. */
export function reconcilePatchReferences(nodes: SchematicNode[], edges: ConnectionEdge[]): SchematicNode[] {
  const existing = new Map(nodes.filter((n): n is PatchReferenceNode => n.type === "patch-reference").map(n => [n.id, n]));
  const wanted = new Set<string>();
  const additions: PatchReferenceNode[] = [];
  const updates = new Map<string, PatchReferenceNode>();
  const lanes = new Map<string, number>();
  for (const edge of edges) {
    const lane = lanes.get(edge.source) ?? 0;
    if (edge.data?.showPatchReferences !== false && edge.data?.patchHops?.length) lanes.set(edge.source, lane + 1);
    const source = nodes.find(n => n.id === edge.source);
    let sourcePosition = source?.position ?? { x: 0, y: 0 };
    let parentId = source?.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = nodes.find(n => n.id === parentId);
      if (!parent) break;
      sourcePosition = { x: sourcePosition.x + parent.position.x, y: sourcePosition.y + parent.position.y };
      parentId = parent.parentId;
    }
    for (const [i, hop] of resolvableHops(edge, nodes).entries()) {
      const id = patchReferenceId(edge.id, hop.panelNodeId, hop.portId);
      const old = existing.get(id);
      
      wanted.add(id);
      const hidden = edge.data?.showPatchReferences === false;
      if (old) {
        const position = { x: Math.round(old.position.x / GRID_SIZE) * GRID_SIZE, y: Math.round(old.position.y / GRID_SIZE) * GRID_SIZE };
        const moved = position.x !== old.position.x || position.y !== old.position.y;
        const resized = old.width !== PATCH_REFERENCE_WIDTH || old.height !== PATCH_REFERENCE_HEIGHT;
        if (!!old.hidden !== hidden || resized || moved) updates.set(id, {
          ...old, position, hidden, width: PATCH_REFERENCE_WIDTH, height: PATCH_REFERENCE_HEIGHT,
          ...(resized ? { measured: undefined } : {}),
        });
      } else additions.push({
        id, type: "patch-reference", position: { x: Math.round((sourcePosition.x + 220 + i * 260) / GRID_SIZE) * GRID_SIZE, y: Math.round((sourcePosition.y + 140 + lane * 100) / GRID_SIZE) * GRID_SIZE },
        width: PATCH_REFERENCE_WIDTH, height: PATCH_REFERENCE_HEIGHT, hidden, zIndex: 5,
        data: { connectionId: edge.id, panelNodeId: hop.panelNodeId, portId: hop.portId },
      });
    }
  }
  const removed = [...existing.keys()].some(id => !wanted.has(id));
  if (!removed && !updates.size && !additions.length) return nodes;
  return [...nodes.filter(n => n.type !== "patch-reference" || wanted.has(n.id)).map(n => updates.get(n.id) ?? n), ...additions];
}

/** Expand only the drawn graph. Reports and port occupancy always use the canonical edges. */
export function patchReferenceEdges(nodes: SchematicNode[], edges: ConnectionEdge[]): ConnectionEdge[] {
  const ids = new Set(nodes.filter(n => n.type === "patch-reference" && !n.hidden).map(n => n.id));
  return edges.flatMap(edge => {
    if (edge.data?.showPatchReferences === false) return [edge];
    const hops = resolvableHops(edge, nodes);
    if (!hops.length) return [edge];
    const refs = hops.map(hop => patchReferenceId(edge.id, hop.panelNodeId, hop.portId));
    if (!refs.every(id => ids.has(id))) return [edge];
    const sections = segmentsForEdge(edge, nodes, edges, edge.data?.cableId ?? edge.id);
    const validOverrides = hops.length === edge.data?.patchHops?.length;
    return Array.from({ length: hops.length + 1 }, (_, i): ConnectionEdge => {
      const override = validOverrides ? edge.data?.patchSegments?.[i] : undefined;
      const baseId = edge.data?.cableId ?? edge.id;
      return {
        ...edge, id: `${edge.id}:patch-section:${i}`, type: "patch-reference-edge", reconnectable: false,
        source: i === 0 ? edge.source : refs[i - 1],
        sourceHandle: i === 0 ? edge.sourceHandle : exitFace(hops[i - 1]),
        target: i === hops.length ? edge.target : refs[i],
        targetHandle: i === hops.length ? edge.targetHandle : entryFace(hops[i]),
        data: {
          ...edge.data!, patchHops: undefined, manualWaypoints: undefined, bundleId: undefined,
          patchReference: { edgeId: edge.id, segmentIndex: i },
          directAttach: sections[i]?.directAttach,
          patchSectionStubbed: override?.stubbed === true,
          cableId: sections[i]?.directAttach ? "" : override?.label?.trim() || `${baseId}-${String.fromCharCode(65 + i)}`,
          cableLength: override?.cableLength ?? "", supplier: override?.supplier ?? edge.data?.supplier,
        },
      };
    });
  });
}

export function canonicalPatchEdgeId(id: string, edges: ConnectionEdge[]): string {
  const marker = id.lastIndexOf(":patch-section:");
  return marker !== -1 && edges.some(e => e.id === id.slice(0, marker)) ? id.slice(0, marker) : id;
}

/** Canonical path handles belong to the compact line, not to the displayed panel sections. */
export function patchReferenceNodes(nodes: SchematicNode[], edges: ConnectionEdge[]): SchematicNode[] {
  const expanded = new Set(edges.filter(e => e.data?.showPatchReferences !== false && e.data?.patchHops?.length).map(e => e.id));
  if (!expanded.size) return nodes;
  return nodes.map(n => n.type === "waypoint" && expanded.has(n.data.edgeId) ? { ...n, hidden: true } : n);
}
