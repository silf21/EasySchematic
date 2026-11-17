import { findPortByHandle } from "./portHandles";
import type { ConnectionEdge, SchematicNode } from "./types";
import type { PageRect } from "./printPageGrid";
import { resolveStubLabelPartsForMode } from "./stubLabelResolve";
import { parentOffsetFromMap } from "./snapUtils";
import { transformLabelNow } from "./labelCaseUtils";

export interface PdfStubReference { text: string; targetPage: number; align: "left" | "right" }
export function formatPdfReference(cable: string, device: string, port: string, room: string, page: number): string {
  return [cable, `→ ${device || "?"}`, port, room, page > 0 ? `Pg ${page}` : ""].filter(Boolean).join(" · ");
}
export function referencePageAt(x: number, y: number, pages: PageRect[]): number {
  return (pages.find(p => x >= p.x && x < p.x + p.widthPx && y >= p.y && y < p.y + p.heightPx)?.index ?? -1) + 1;
}

/** Export-only labels: no edits to node positions, dimensions or canonical edges. */
export function collectPdfStubReferences(root: HTMLElement, nodes: SchematicNode[], edges: ConnectionEdge[], pages: PageRect[], hiddenAdapterIds: Set<string>, cableIdMap: Record<string, string>): Map<Element, PdfStubReference> {
  const result = new Map<Element, PdfStubReference>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const pageAt = (x: number, y: number) => referencePageAt(x, y, pages);
  for (const el of root.querySelectorAll<HTMLElement>("[data-pdf-stub-id]")) {
    const node = nodeMap.get(el.dataset.pdfStubId!);
    if (node?.type !== "stub-label") continue;
    const parts = resolveStubLabelPartsForMode(node.id, node.data, { nodes, edges, pageAt, hiddenAdapterIds, cableIdMap, includePhysicalFace: true });
    if (!parts) continue;
    // Respect intentionally cable-ID-only tags; they still receive a PDF link.
    const text = node.data.labelMode === "cableId" ? parts.cableId || "—" : formatPdfReference(parts.cableId, transformLabelNow(parts.farLabel), parts.farPort, transformLabelNow(parts.farRoom), Number(parts.farPage));
    const own = edges.find(e => node.data.side === "source" ? e.target === node.id : e.source === node.id);
    const handle = node.data.side === "source" ? own?.targetHandle : own?.sourceHandle;
    result.set(el, { text, targetPage: Number(parts.farPage), align: handle === "r" ? "right" : "left" });
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-pdf-target-node]")) {
    const node = nodeMap.get(el.dataset.pdfTargetNode!);
    if (!node) continue;
    const handle = el.dataset.pdfTargetHandle ?? "";
    const panel = node.type === "patch-reference" ? nodeMap.get(node.data.panelNodeId) : node;
    const port = panel?.type === "device" ? node.type === "patch-reference" ? panel.data.ports.find(p => p.id === node.data.portId) : findPortByHandle(panel.data, handle) : undefined;
    const face = node.type === "patch-reference" ? handle : port?.direction === "passthrough" ? handle === `${port.id}-front` ? "front" : handle === `${port.id}-rear` ? "rear" : "" : "";
    const offset = parentOffsetFromMap(node, nodeMap);
    const page = pageAt(node.position.x + offset.dx + (node.measured?.width ?? node.width ?? 144) / 2, node.position.y + offset.dy + (node.measured?.height ?? node.height ?? 48) / 2);
    result.set(el, { text: formatPdfReference(el.dataset.pdfCableId ?? "", transformLabelNow(String(panel?.data.label ?? "?")), [port?.label, face].filter(Boolean).join(" / "), String(node.parentId ? nodeMap.get(node.parentId)?.data.label ?? "" : ""), page), targetPage: page, align: el.dataset.pdfAlign === "right" ? "right" : "left" });
  }
  return result;
}
