import { describe, expect, it } from "vitest";
import type { ConnectionEdge, DeviceData, SchematicNode } from "../types";
import { computeCableSchedule, buildCableScheduleCsv } from "../cableSchedule";
import { computePackList, cableUnitCost, mergeDevicesByModel, mergeCablesByType } from "../packList";
import { computeSupplierMaterials, supplierGroups, buildSupplierCsv } from "../supplierReport";
import { getPanelOccupancy, resolvePortDisplay, getPatchSegments, devicePoint } from "../patchCircuits";
import { computePatchPanelSchedule } from "../patchPanelSchedule";
import { migrateSchematic, CURRENT_SCHEMA_VERSION } from "../migrations";
import { includedInPackList, usedSuppliers } from "../suppliers";
import { patchReferenceEdges, reconcilePatchReferences } from "../patchReferences";

const device = (id: string, data: Partial<DeviceData>): SchematicNode => ({ id, type: "device", position: { x: 0, y: 0 }, data: { label: id, deviceType: "generic", ports: [], ...data } });
const nodes = [
  device("Desk", { ports: [{ id: "out", label: "DMX out", direction: "output", signalType: "dmx", connectorType: "xlr-3" }] }),
  device("Fixture", { ports: [{ id: "in", label: "DMX in", direction: "input", signalType: "dmx", connectorType: "xlr-3" }] }),
  ...["PP1", "PP2"].map(id => device(id, { deviceType: "patch-panel", supplier: "Festinstalliert", ports: [{ id: "p", label: "DMX A", direction: "passthrough", signalType: "dmx", rearConnectorType: "xlr-5", frontConnectorType: "xlr-3" }] })),
];
const edge = (data: Partial<NonNullable<ConnectionEdge["data"]>> = {}): ConnectionEdge => ({ id: "e", source: "Desk", target: "Fixture", sourceHandle: "out", targetHandle: "in", data: { signalType: "dmx", cableId: "D001", ...data } });
const patched = () => edge({ supplier: "Rental", patchHops: [{ panelNodeId: "PP1", portId: "p", entryFace: "front" }, { panelNodeId: "PP2", portId: "p" }], patchSegments: [{ unitCost: 12 }, { supplier: " FestINSTALLIERT ", unitCost: 100 }, { unitCost: 12 }] });

describe("physical material and supplier accounting", () => {
  it("excludes fixed panels and the rear-to-rear installed run, retaining the complete schedule", () => {
    const e = patched();
    const schedule = computeCableSchedule(nodes, [e]);
    expect(schedule).toHaveLength(3);
    const pack = computePackList(nodes, [e]);
    expect(pack.cables).toHaveLength(2);
    expect(pack.devices.some(d => d.model.startsWith("PP"))).toBe(false);
    expect(supplierGroups(computeSupplierMaterials(nodes, [e])).find(g => g.supplier === "Rental")?.cost).toBe(24);
    expect(buildCableScheduleCsv(schedule, "show")).toContain("Festinstalliert");
    expect(buildSupplierCsv(computeSupplierMaterials(nodes, [e]))).not.toContain("Festinstalliert");
    expect(includedInPackList(undefined)).toBe(true);
    expect(includedInPackList("  festinstalliert  ")).toBe(false);
  });
  it("uses reversed physical faces consistently, without changing material data", () => {
    const e = patched();
    const segs = getPatchSegments(e, nodes, "D001", devicePoint(nodes, "Desk", "out"), devicePoint(nodes, "Fixture", "in"));
    expect(segs[0].to.port?.connectorType).toBe("xlr-3");
    expect(segs[1].from.port?.connectorType).toBe("xlr-5");
    expect(segs[1].to.port?.connectorType).toBe("xlr-5");
    const display = resolvePortDisplay("PP1", "p", getPanelOccupancy(nodes, [e]), nodes, [e], () => "D001");
    expect(display?.front?.cableLabel).toBe("D001-A");
    expect(display?.rear?.cableLabel).toBe("D001-B");
    const row = computePatchPanelSchedule(nodes, [e]).find(r => r.panelId === "PP1");
    expect(row?.frontCableId).toBe("D001-A");
    expect(row?.rearCableId).toBe("D001-B");
  });
  it("never merges identical materials belonging to different suppliers or prices", () => {
    const devices = [device("a", { model: "Lamp", supplier: "A", unitCost: 10 }), device("b", { model: "Lamp", supplier: "B", unitCost: 20 })];
    expect(mergeDevicesByModel(computePackList(devices, []).devices)).toHaveLength(2);
    const rows = ["A", "B"].map(supplier => ({ cableType: "DMX", signalType: "DMX", cableLength: "10m", route: "", count: 1, supplier }));
    expect(mergeCablesByType(rows)).toHaveLength(2);
    expect(cableUnitCost(rows[0], { "DMX|DMX|10m": 8, "DMX|DMX|10m|supplier:a": 12 })).toBe(12);
    expect(cableUnitCost(rows[1], { "DMX|DMX|10m": 8 })).toBe(8);
  });
  it("always offers Festinstalliert and deduplicates shared supplier suggestions", () => {
    expect(usedSuppliers([device("x", { supplier: " Rental  House " })], [edge({ supplier: "rental house" })])).toEqual(["Festinstalliert", "Rental House"]);
    expect(usedSuppliers([], [])).toEqual(["Festinstalliert"]);
  });
  it("upgrades the schema without rewriting supplier values", () => {
    const e = edge({ supplier: "Original Supplier" });
    const migrated = migrateSchematic({ version: 45, nodes, edges: [e] });
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.edges).toEqual([e]);
  });
});

describe("distributed patch references", () => {
  it("draws Front→Rear followed by Rear→Front with a rear-to-rear cable", () => {
    const e = patched();
    const diagramNodes = reconcilePatchReferences(nodes, [e]);
    const refs = diagramNodes.filter(n => n.type === "patch-reference");
    expect(refs).toHaveLength(2);
    const diagram = patchReferenceEdges(diagramNodes, [e]);
    expect(diagram.map(e => [e.sourceHandle, e.targetHandle])).toEqual([["out", "front"], ["rear", "rear"], ["front", "in"]]);
    expect(computePackList(diagramNodes, [e])).toEqual(computePackList(nodes, [e]));
    expect(reconcilePatchReferences(diagramNodes, [e])).toBe(diagramNodes);
  });
  it("retains independent placements through compact view and cleans up removed assignments", () => {
    const e = patched();
    let diagram = reconcilePatchReferences(nodes, [e]);
    const ref = diagram.find(n => n.type === "patch-reference")!;
    diagram = diagram.map(n => n.id === ref.id ? { ...n, position: { x: 1000, y: 200 } } : n);
    const compact = { ...e, data: { ...e.data!, showPatchReferences: false } };
    const hidden = reconcilePatchReferences(diagram, [compact]);
    expect(hidden.find(n => n.id === ref.id)?.hidden).toBe(true);
    expect(patchReferenceEdges(hidden, [compact])).toEqual([compact]);
    expect(reconcilePatchReferences(hidden, [e]).find(n => n.id === ref.id)?.position).toEqual({ x: 1008, y: 208 });
    expect(reconcilePatchReferences(hidden, []).some(n => n.type === "patch-reference")).toBe(false);
  });
  it("represents a shared panel separately for different circuits, with one real device", () => {
    const panel = device("PP", { deviceType: "patch-panel", ports: ["p1", "p2"].map(id => ({ id, label: id, direction: "passthrough", signalType: "dmx" })) });
    const edges = ["p1", "p2"].map((portId, i) => ({ ...edge({ patchHops: [{ panelNodeId: "PP", portId }] }), id: `e${i}` }));
    const diagram = reconcilePatchReferences([...nodes.slice(0, 2), panel], edges);
    expect(diagram.filter(n => n.type === "patch-reference")).toHaveLength(2);
    expect(computePackList(diagram, edges).devices.find(d => d.model === "PP")?.count).toBe(1);
    expect(getPanelOccupancy(diagram, edges).get("PP")?.size).toBe(2);
  });
});

describe("reference editing in the store", () => {
  it("supports undo/redo of a face change and hides a deleted reference without deleting the circuit", async () => {
    const { useSchematicStore: store } = await import("../store");
    const before = store.getState();
    const e = patched();
    store.setState({ nodes, edges: [e] });
    const ref = store.getState().nodes.find(n => n.type === "patch-reference")!;
    store.getState().patchEdgeData(e.id, { patchHops: e.data!.patchHops!.map((h, i) => i === 0 ? { ...h, entryFace: "rear" } : h) });
    expect(store.getState().edges[0].data?.patchHops?.[0].entryFace).toBe("rear");
    store.getState().undo();
    expect(store.getState().edges[0].data?.patchHops?.[0].entryFace).toBe("front");
    store.getState().redo();
    expect(store.getState().edges[0].data?.patchSegments).toEqual(e.data?.patchSegments);
    store.setState({ nodes: store.getState().nodes.map(n => ({ ...n, selected: n.id === ref.id })), edges: store.getState().edges.map(e => ({ ...e, selected: false })) });
    store.getState().removeSelected();
    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0].data?.patchHops).toHaveLength(2);
    expect(store.getState().nodes.find(n => n.id === ref.id)?.hidden).toBe(true);
    expect(store.getState().nodes.find(n => n.id === ref.id)?.position).toEqual(ref.position);
    while (store.getState().undoSize > 0) store.getState().undo();
    store.setState({ nodes: before.nodes, edges: before.edges });
  });
});

it("exports distributed references and section IDs to DXF without the hidden central panel", async () => {
  const { useSchematicStore: store } = await import("../store");
  const { buildDxf } = await import("../dxfExport");
  const before = store.getState();
  const e = patched();
  const original = nodes.map(n => n.type === "device" && n.data.deviceType === "patch-panel" ? { ...n, hidden: true, data: { ...n.data, offCanvas: true } } : n);
  store.setState({ nodes: original, edges: [e] });
  const diagram = patchReferenceEdges(store.getState().nodes, [e]);
  store.setState({ routedEdges: Object.fromEntries(diagram.map((edge, i) => [edge.id, { edgeId: edge.id, svgPath: `M 0 ${i * 100} L 100 ${i * 100}`, waypoints: [{ x: 0, y: i * 100 }, { x: 100, y: i * 100 }], segments: [{ x1: 0, y1: i * 100, x2: 100, y2: i * 100, axis: "h" as const }], labelX: 50, labelY: i * 100, turns: "" }])) });
  const rf = { getInternalNode: (id: string) => {
    const node = store.getState().nodes.find(n => n.id === id);
    return node && { internals: { positionAbsolute: node.position, handleBounds: { source: [], target: [] } }, measured: { width: 220, height: 80 } };
  } } as unknown as import("@xyflow/react").ReactFlowInstance;
  const dxf = buildDxf(rf)!;
  expect(dxf.match(/PP1/g)).toHaveLength(1);
  expect(dxf).toContain("D001-B");
  store.setState({ nodes: before.nodes, edges: before.edges, routedEdges: before.routedEdges });
});

it("counts adapter plug attachments as no cable while retaining a fixed virtual panel-to-panel cable", () => {
  const adapters = [
    device("A", { deviceType: "adapter", ports: [{ id: "in", label: "3", direction: "input", connectorType: "xlr-3", signalType: "dmx" }, { id: "out", label: "5", direction: "output", connectorType: "xlr-5", signalType: "dmx", directAttach: true }] }),
    device("B", { deviceType: "adapter", ports: [{ id: "in", label: "5", direction: "input", connectorType: "xlr-5", signalType: "dmx", directAttach: true }, { id: "out", label: "3", direction: "output", connectorType: "xlr-3", signalType: "dmx" }] }),
  ];
  const all = [...nodes, ...adapters];
  const e = { ...patched(), source: "A", sourceHandle: "out", target: "B", targetHandle: "in", data: { ...patched().data!, directAttach: true } };
  const left = { ...edge(), id: "left", target: "A" };
  const right = { ...edge(), id: "right", source: "B" };
  const edges = [left, e, right];
  const schedule = computeCableSchedule(all, edges);
  expect(schedule).toHaveLength(3);
  expect(schedule.find(r => r.edgeId === e.id)?.cableId).toBe("D001-B");
  const pack = computePackList(all, edges);
  expect(pack.cables).toHaveLength(2);
  expect(pack.adapters.reduce((n, a) => n + a.count, 0)).toBe(2);
  const diagram = patchReferenceEdges(reconcilePatchReferences(all, edges), edges).filter(e => e.data?.patchReference);
  expect(diagram.map(e => !!e.data?.directAttach)).toEqual([true, false, true]);
});

it("stubs an individual patch section without changing quantities, and supports undo", async () => {
  const { useSchematicStore: store } = await import("../store");
  const before = store.getState();
  try {
    const e = patched();
    store.setState({ nodes, edges: [e] });
    const materials = computePackList(store.getState().nodes, store.getState().edges);
    store.getState().setPatchSegmentOverride(e.id, 1, { stubbed: true });
    const diagram = patchReferenceEdges(store.getState().nodes, store.getState().edges);
    expect(diagram.map(e => e.data?.patchSectionStubbed)).toEqual([false, true, false]);
    expect(computePackList(store.getState().nodes, store.getState().edges)).toEqual(materials);
    expect(store.getState().edges[0].data?.patchSegments?.[1].supplier).toBe(" FestINSTALLIERT ");
    store.getState().undo();
    expect(store.getState().edges[0].data?.patchSegments?.[1].stubbed).toBeUndefined();
    store.getState().redo();
    expect(store.getState().edges[0].data?.patchSegments?.[1].stubbed).toBe(true);
    store.getState().setPatchSegmentOverride(e.id, 1, { stubbed: false });
    expect(patchReferenceEdges(store.getState().nodes, store.getState().edges).every(e => !e.data?.patchSectionStubbed)).toBe(true);
  } finally { store.setState(before); }
});
