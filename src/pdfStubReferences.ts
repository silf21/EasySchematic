import { findPortByHandle } from "./portHandles";
import type { ConnectionEdge, SchematicNode } from "./types";
import type { PageRect } from "./printPageGrid";
import { resolveStubLabelPartsForMode } from "./stubLabelResolve";
import { parentOffsetFromMap } from "./snapUtils";
import { transformLabelNow } from "./labelCaseUtils";

export interface PdfStubReference { text: string; targetPage: number; align: "left" | "right" }
export function formatPdfReference(device: string, port: string, room: string, page: number, ownPage = 0, sameRoom = false): string {
  const portLabel = port.replace(/ \/ (front|rear)$/i, (_match, face: string) => ` (${face[0].toUpperCase()}${face.slice(1).toLowerCase()})`);
  return [page > 0 && page !== ownPage ? `Pg ${page}` : "", sameRoom ? "" : room, device || "?", portLabel].filter(Boolean).join(" / ");
}
export function referencePageAt(x: number, y: number, pages: PageRect[]): number {
  return (pages.find(p => x >= p.x && x < p.x + p.widthPx && y >= p.y && y < p.y + p.heightPx)?.index ?? -1) + 1;
}

/** Export-only labels: no edits to node positions, dimensions or canonical edges. */
export function collectPdfStubReferences(root: HTMLElement, nodes: SchematicNode[], edges: ConnectionEdge[], pages: PageRect[], hiddenAdapterIds: Set<string>, cableIdMap: Record<string, string>, currentPage?: number): Map<Element, PdfStubReference> {
  const result = new Map<Element, PdfStubReference>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const pageAt = (x: number, y: number) => referencePageAt(x, y, pages);
  for (const el of root.querySelectorAll<HTMLElement>("[data-pdf-stub-id]")) {
    const node = nodeMap.get(el.dataset.pdfStubId!);
    if (node?.type !== "stub-label") continue;
    const parts = resolveStubLabelPartsForMode(node.id, node.data, { nodes, edges, pageAt, hiddenAdapterIds, cableIdMap, includePhysicalFace: true });
    if (!parts) continue;
    // Respect intentionally cable-ID-only tags; they still receive a PDF link.
    const text = node.data.labelMode === "cableId" ? parts.cableId || "—" : formatPdfReference(transformLabelNow(parts.farLabel), parts.farPort, transformLabelNow(parts.farRoom), Number(parts.farPage), currentPage ?? Number(parts.myPage), parts.sameRoom);
    const own = edges.find(e => node.data.side === "source" ? e.target === node.id : e.source === node.id);
    const handle = node.data.side === "source" ? own?.targetHandle : own?.sourceHandle;
    result.set(el, { text, targetPage: Number(parts.farPage), align: handle === "r" ? "right" : "left" });
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-pdf-target-node]")) {
    const node = nodeMap.get(el.dataset.pdfTargetNode!);
    if (!node) continue;
    const handle = el.dataset.pdfTargetHandle ?? "";
    const near = nodeMap.get(el.dataset.pdfSourceNode ?? "");
    const roomId = (n: SchematicNode | undefined) => {
      const seen = new Set<string>();
      while (n?.parentId && !seen.has(n.parentId)) {
        seen.add(n.parentId);
        n = nodeMap.get(n.parentId);
        if (n?.type === "room") return n.id;
      }
      return undefined;
    };
    const targetRoom = roomId(node);
    const sameRoom = !!targetRoom && targetRoom === roomId(near);
    const panel = node.type === "patch-reference" ? nodeMap.get(node.data.panelNodeId) : node;
    const port = panel?.type === "device" ? node.type === "patch-reference" ? panel.data.ports.find(p => p.id === node.data.portId) : findPortByHandle(panel.data, handle) : undefined;
    const face = node.type === "patch-reference" ? handle : port?.direction === "passthrough" ? handle === `${port.id}-front` ? "front" : handle === `${port.id}-rear` ? "rear" : "" : "";
    const offset = parentOffsetFromMap(node, nodeMap);
    const page = pageAt(node.position.x + offset.dx + (node.measured?.width ?? node.width ?? 144) / 2, node.position.y + offset.dy + (node.measured?.height ?? node.height ?? 48) / 2);
    const nearOffset = near ? parentOffsetFromMap(near, nodeMap) : { dx: 0, dy: 0 };
    const ownPage = currentPage ?? (near ? pageAt(near.position.x + nearOffset.dx + (near.measured?.width ?? near.width ?? 144) / 2, near.position.y + nearOffset.dy + (near.measured?.height ?? near.height ?? 48) / 2) : 0);
    result.set(el, { text: formatPdfReference(transformLabelNow(String(panel?.data.label ?? "?")), [port?.label, face].filter(Boolean).join(" / "), transformLabelNow(String(targetRoom ? nodeMap.get(targetRoom)?.data.label ?? "" : "")), page, ownPage, sameRoom), targetPage: page, align: el.dataset.pdfAlign === "right" ? "right" : "left" });
  }
  return result;
}
