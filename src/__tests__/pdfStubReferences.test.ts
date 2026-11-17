import { expect, it } from "vitest";
import { formatPdfReference, referencePageAt } from "../pdfStubReferences";
import type { PageRect } from "../printPageGrid";

it("uses a consistent cable / destination / port / room / page order", () => {
  expect(formatPdfReference("DX035-B", "FOH", "DMX1 / rear", "Technikturm", 1)).toBe("DX035-B · → FOH · DMX1 / rear · Technikturm · Pg 1");
  expect(formatPdfReference("DX035-B", "Stage", "DMX1 / front", "Hauptbühne", 2)).toContain("DX035-B · → Stage");
});
it("does not invent page numbers or missing identifiers", () => {
  expect(formatPdfReference("", "Desk", "", "", 0)).toBe("→ Desk");
  expect(formatPdfReference("D001", "", "", "", 0)).toBe("D001 · → ?");
});
it("looks up actual emitted page indices, including empty skipped grid cells", () => {
  const pages = [{ index: 0, x: 0, y: 0, widthPx: 100, heightPx: 100 }, { index: 1, x: 200, y: 0, widthPx: 100, heightPx: 100 }] as PageRect[];
  expect(referencePageAt(20, 20, pages)).toBe(1);
  expect(referencePageAt(220, 20, pages)).toBe(2);
  expect(referencePageAt(100, 20, pages)).toBe(0);
  expect(referencePageAt(200, 20, pages)).toBe(2);
});

it("resolves distributed panel references using their own room and physical face", async () => {
  const { collectPdfStubReferences } = await import("../pdfStubReferences");
  const element = { dataset: { pdfTargetNode: "ref", pdfTargetHandle: "rear", pdfCableId: "DX035-B", pdfAlign: "left" } };
  const root = { querySelectorAll: (selector: string) => selector === "[data-pdf-target-node]" ? [element] : [] } as unknown as HTMLElement;
  const nodes = [
    { id: "room", type: "room", position: { x: 200, y: 0 }, data: { label: "Stage" } },
    { id: "panel", type: "device", position: { x: 0, y: 0 }, data: { label: "FOH Panel", deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } },
    { id: "ref", type: "patch-reference", parentId: "room", position: { x: 0, y: 0 }, width: 144, height: 64, data: { connectionId: "e", panelNodeId: "panel", portId: "p" } },
  ] as import("../types").SchematicNode[];
  const pages = [{ index: 0, x: 0, y: 0, widthPx: 200, heightPx: 200 }, { index: 1, x: 200, y: 0, widthPx: 200, heightPx: 200 }] as PageRect[];
  const references = collectPdfStubReferences(root, nodes, [], pages, new Set(), {});
  expect(references.get(element as unknown as Element)).toEqual({ text: "DX035-B · → FOH Panel · DMX1 / rear · Stage · Pg 2", targetPage: 2, align: "left" });
  expect(nodes[2].position).toEqual({ x: 0, y: 0 });
});

it("keeps cable-ID-only stub preferences and still links to the other page", async () => {
  const { collectPdfStubReferences } = await import("../pdfStubReferences");
  const element = { dataset: { pdfStubId: "stub-source" } };
  const root = { querySelectorAll: (selector: string) => selector === "[data-pdf-stub-id]" ? [element] : [] } as unknown as HTMLElement;
  const nodes = [
    { id: "source", type: "device", position: { x: 10, y: 10 }, data: { label: "Desk", deviceType: "generic", ports: [] } },
    { id: "target", type: "device", position: { x: 210, y: 10 }, data: { label: "Remote", deviceType: "generic", ports: [] } },
    { id: "stub-source", type: "stub-label", position: { x: 50, y: 10 }, data: { signalType: "dmx", side: "source", linkedConnectionId: "pair", labelMode: "cableId" } },
    { id: "stub-target", type: "stub-label", position: { x: 250, y: 10 }, data: { signalType: "dmx", side: "target", linkedConnectionId: "pair" } },
  ] as import("../types").SchematicNode[];
  const edges = [
    { id: "e-source", source: "source", target: "stub-source", targetHandle: "l", data: { signalType: "dmx", cableId: "DX001", linkedConnectionId: "pair" } },
    { id: "e-target", source: "stub-target", sourceHandle: "r", target: "target", data: { signalType: "dmx", linkedConnectionId: "pair" } },
  ] as import("../types").ConnectionEdge[];
  const pages = [{ index: 0, x: 0, y: 0, widthPx: 200, heightPx: 200 }, { index: 1, x: 200, y: 0, widthPx: 200, heightPx: 200 }] as PageRect[];
  expect(collectPdfStubReferences(root, nodes, edges, pages, new Set(), {}).get(element as unknown as Element)).toEqual({ text: "DX001", targetPage: 2, align: "left" });
});

it.each(["front", "rear"])("adds a real panel's %s face only for export", async face => {
  const { resolveStubLabelPartsForMode } = await import("../stubLabelResolve");
  const nodes = [
    { id: "source", type: "device", position: { x: 0, y: 0 }, data: { label: "Desk", deviceType: "generic", ports: [] } },
    { id: "panel", type: "device", position: { x: 200, y: 0 }, data: { label: "Panel", deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } },
    { id: "s", type: "stub-label", position: { x: 50, y: 0 }, data: { signalType: "dmx", side: "source", linkedConnectionId: "pair" } },
    { id: "t", type: "stub-label", position: { x: 150, y: 0 }, data: { signalType: "dmx", side: "target", linkedConnectionId: "pair" } },
  ] as import("../types").SchematicNode[];
  const edges = [{ id: "a", source: "source", target: "s", data: { signalType: "dmx", linkedConnectionId: "pair" } }, { id: "b", source: "t", target: "panel", targetHandle: `p-${face}`, data: { signalType: "dmx", linkedConnectionId: "pair" } }] as import("../types").ConnectionEdge[];
  const data = { side: "source" as const, linkedConnectionId: "pair" };
  expect(resolveStubLabelPartsForMode("s", data, { nodes, edges })?.farPort).toBe("DMX1");
  expect(resolveStubLabelPartsForMode("s", data, { nodes, edges, includePhysicalFace: true })?.farPort).toBe(`DMX1 / ${face}`);
});
