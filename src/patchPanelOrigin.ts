import type { ConnectionEdge, SchematicNode } from "./types";
import { resolvePort, resolvePortLabel } from "./packList";
import { transformLabelNow } from "./labelCaseUtils";

export interface PatchOrigin { nodeId?: string; handleId?: string | null; status: "resolved" | "open" | "ambiguous" | "loop" | "missing" }

/** Follow only unambiguous passive paths. Active devices (including switches) are endpoints. */
export function resolvePatchOrigin(nodeId: string, handleId: string | null | undefined, arrivedVia: string, nodes: readonly SchematicNode[], edges: readonly ConnectionEdge[]): PatchOrigin {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const seen = new Set<string>();
  let current = { nodeId, handleId: handleId ?? null };
  let previous = arrivedVia;
  while (true) {
    const key = `${current.nodeId}:${current.handleId}`;
    if (seen.has(key)) return { status: "loop" };
    seen.add(key);
    const node = nodeMap.get(current.nodeId);
    if (!node) return { status: "missing" };
    if (node.type === "stub-label") {
      const own = edges.find(edge => edge.id === previous);
      const link = own?.data?.linkedConnectionId;
      if (!link) return { status: "open" };
      const partners = edges.filter(edge => edge.id !== previous && edge.data?.linkedConnectionId === link);
      if (partners.length !== 1) return { status: partners.length ? "ambiguous" : "open" };
      const partner = partners[0];
      const sourceIsDevice = nodeMap.get(partner.source)?.type === "device";
      const targetIsDevice = nodeMap.get(partner.target)?.type === "device";
      if (sourceIsDevice === targetIsDevice) return { status: "ambiguous" };
      current = { nodeId: sourceIsDevice ? partner.source : partner.target, handleId: (sourceIsDevice ? partner.sourceHandle : partner.targetHandle) ?? null };
      previous = partner.id;
      continue;
    }
    if (node.type !== "device") return { status: "missing" };
    const passive = node.data.deviceType === "adapter" || node.data.deviceType === "patch-panel";
    if (!passive) return { ...current, status: "resolved" };
    const port = resolvePort(node, current.handleId);
    if (!port) return { status: "missing" };
    let onwardHandle: string | undefined;
    let onwardPortId: string | undefined;
    if (node.data.deviceType === "patch-panel") {
      if (port.direction !== "passthrough" || port.normalledTo && port.normalling !== "none") return { status: "ambiguous" };
      if (current.handleId === `${port.id}-rear`) onwardHandle = `${port.id}-front`;
      else if (current.handleId === `${port.id}-front`) onwardHandle = `${port.id}-rear`;
      else return { status: "missing" };
    } else {
      // Multi-port adapters need an explicit internal map; never guess one from edge order.
      if (node.data.ports.length !== 2) return { status: "ambiguous" };
      onwardPortId = node.data.ports.find(p => p.id !== port.id)?.id;
    }
    const candidates = edges.filter(edge => {
      if (edge.id === previous) return false;
      const handle = edge.source === node.id ? edge.sourceHandle : edge.target === node.id ? edge.targetHandle : undefined;
      if (!handle) return false;
      return onwardHandle ? handle === onwardHandle : resolvePort(node, handle)?.id === onwardPortId;
    });
    if (candidates.length !== 1) return { status: candidates.length ? "ambiguous" : "open" };
    const edge = candidates[0];
    const leavingSource = edge.source === node.id;
    current = { nodeId: leavingSource ? edge.target : edge.source, handleId: (leavingSource ? edge.targetHandle : edge.sourceHandle) ?? null };
    previous = edge.id;
  }
}

export function patchOriginFields(nodeId: string, handleId: string | null | undefined, arrivedVia: string, nodes: readonly SchematicNode[], edges: readonly ConnectionEdge[]): { originDevice: string; originPort: string } {
  const origin = resolvePatchOrigin(nodeId, handleId, arrivedVia, nodes, edges);
  const node = nodes.find(n => n.id === origin.nodeId);
  if (origin.status === "resolved" && node?.type === "device") return { originDevice: transformLabelNow(node.data.label || "Unnamed"), originPort: resolvePortLabel(node, origin.handleId) || "—" };
  const reasons = { open: "open passive path", ambiguous: "ambiguous passive path", loop: "passive loop", missing: "missing endpoint" };
  return { originDevice: `Unresolved: ${reasons[origin.status === "resolved" ? "missing" : origin.status]}`, originPort: "—" };
}
