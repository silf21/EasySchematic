import { describe, expect, it } from "vitest";
import type { ConnectionEdge, DeviceData, SchematicNode } from "../types";
import { computeCableSchedule, buildCableScheduleCsv } from "../cableSchedule";
import { computePackList, cableUnitCost, mergeDevicesByModel, mergeCablesByType } from "../packList";
import { computeSupplierMaterials, supplierGroups, buildSupplierCsv } from "../supplierReport";
import { getPanelOccupancy, resolvePortDisplay, getPatchSegments, devicePoint } from "../patchCircuits";
import { computePatchPanelSchedule } from "../patchPanelSchedule";
import { migrateSchematic, CURRENT_SCHEMA_VERSION } from "../migrations";
import { usedSuppliers } from "../suppliers";

const device = (id: string, data: Partial<DeviceData>): SchematicNode => ({ id, type: "device", position: { x: 0, y: 0 }, data: { label: id, deviceType: "generic", ports: [], ...data } });
const nodes = [
  device("Desk", { ports: [{ id: "out", label: "DMX out", direction: "output", signalType: "dmx", connectorType: "xlr-3" }] }),
  device("Fixture", { ports: [{ id: "in", label: "DMX in", direction: "input", signalType: "dmx", connectorType: "xlr-3" }] }),
  ...["PP1", "PP2"].map(id => device(id, { deviceType: "patch-panel", provision: "installed", ports: [{ id: "p", label: "DMX A", direction: "passthrough", signalType: "dmx", rearConnectorType: "xlr-5", frontConnectorType: "xlr-3" }] })),
];
const edge = (data: Partial<NonNullable<ConnectionEdge["data"]>> = {}): ConnectionEdge => ({ id: "e", source: "Desk", target: "Fixture", sourceHandle: "out", targetHandle: "in", data: { signalType: "dmx", cableId: "D001", ...data } });

describe("physical material and supplier accounting", () => {
  it("counts the DMX setup as four portable cables and one installed run, with no adapter devices", () => {
    const e = edge({ supplier: "Rental", patchHops: [{ panelNodeId: "PP1", portId: "p" }, { panelNodeId: "PP2", portId: "p", entryFace: "front" }], patchSegments: [
      { cables: [{ id: "a", label: "DMX 3pin", cableLength: "10m", unitCost: 12 }, { id: "b", label: "Adapter 3→5", sourceConnector: "xlr-3", targetConnector: "xlr-5", unitCost: 5 }] },
      { provision: "installed", cables: [{ id: "c", label: "Installed DMX", unitCost: 100 }] },
      { cables: [{ id: "d", label: "Adapter 5→3", unitCost: 5 }, { id: "e", label: "DMX 3pin", cableLength: "10m", unitCost: 12 }] },
    ] });
    const schedule = computeCableSchedule(nodes, [e]);
    expect(schedule).toHaveLength(5);
    expect(schedule.filter(r => r.provision === "installed")).toHaveLength(1);
    const pack = computePackList(nodes, [e]);
    expect(pack.cables).toHaveLength(4);
    expect(pack.summary.reduce((n, r) => n + r.count, 0)).toBe(4);
    expect(pack.devices.some(d => d.model.startsWith("PP"))).toBe(false);
    const groups = supplierGroups(computeSupplierMaterials(nodes, [e]));
    expect(groups.find(g => g.supplier === "Rental")?.cost).toBe(34);
    expect(buildCableScheduleCsv(schedule, "show")).toContain("Installed DMX");
    expect(buildSupplierCsv(computeSupplierMaterials(nodes, [e]))).not.toContain("Installed DMX");
  });
  it("uses reversed panel connectors consistently in segments, display and schedule", () => {
    const e = edge({ patchHops: [{ panelNodeId: "PP1", portId: "p", entryFace: "front" }] });
    const segs = getPatchSegments(e, nodes, "D001", devicePoint(nodes, "Desk", "out"), devicePoint(nodes, "Fixture", "in"));
    expect(segs[0].to.port?.connectorType).toBe("xlr-3");
    expect(segs[1].from.port?.connectorType).toBe("xlr-5");
    const display = resolvePortDisplay("PP1", "p", getPanelOccupancy(nodes, [e]), nodes, [e], () => "D001");
    expect(display?.front?.cableLabel).toBe("D001-A");
    expect(display?.rear?.cableLabel).toBe("D001-B");
    const row = computePatchPanelSchedule(nodes, [e]).find(r => r.panelId === "PP1");
    expect(row?.frontCableId).toBe("D001-A");
    expect(row?.rearCableId).toBe("D001-B");
  });
  it("never merges identical materials belonging to different suppliers or prices", () => {
    const devices = [device("a", { model: "Lamp", supplier: "A", unitCost: 10 }), device("b", { model: "Lamp", supplier: "B", unitCost: 20 })];
    const pack = computePackList(devices, []);
    expect(mergeDevicesByModel(pack.devices)).toHaveLength(2);
    const rows = [{ cableType: "DMX", signalType: "DMX", cableLength: "10m", route: "", count: 1, supplier: "A" }, { cableType: "DMX", signalType: "DMX", cableLength: "10m", route: "", count: 1, supplier: "B" }];
    expect(mergeCablesByType(rows)).toHaveLength(2);
    expect(cableUnitCost(rows[0], { "DMX|DMX|10m": 8, "DMX|DMX|10m|supplier:a": 12 })).toBe(12);
    expect(cableUnitCost(rows[1], { "DMX|DMX|10m": 8 })).toBe(8);
  });
  it("keeps base cable ids stable for inline cables without panel hops", () => {
    const rows = computeCableSchedule(nodes, [edge({ cables: [{ id: "a" }, { id: "b", label: "Adapter" }] })]);
    expect(rows.map(r => r.cableId)).toEqual(["D001.1", "D001.2"]);
    expect(rows.every(r => r.baseCableId === "D001")).toBe(true);
  });
  it("shares deduplicated supplier suggestions across devices, connections and inline material", () => {
    expect(usedSuppliers([device("x", { supplier: " Rental  House " })], [edge({ supplier: "rental house", cables: [{ id: "a", supplier: "B" }] })])).toEqual(["B", "Rental House"]);
  });
  it("upgrades old projects without changing default patch direction or provisioning", () => {
    const e = edge({ patchHops: [{ panelNodeId: "PP1", portId: "p" }] });
    const migrated = migrateSchematic({ version: 44, nodes, edges: [e] });
    expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.edges).toEqual([e]);
    expect(computePackList(nodes, [e]).cables).toHaveLength(2);
  });
});
