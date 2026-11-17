import { it, expect } from "vitest";
import type { SchematicNode, DeviceData, ConnectionEdge } from "../types";
import { resolvePatchOrigin } from "../patchPanelOrigin";
import { computePatchPanelSchedule, buildPatchPanelScheduleCsv, filterPatchPanelScheduleRows, getPatchPanelScheduleTableData } from "../patchPanelSchedule";
import { createDefaultPatchPanelScheduleLayout } from "../reportLayout";

const device = (id: string, data: Partial<DeviceData>): SchematicNode => ({ id, type: "device", position: { x: 0, y: 0 }, data: { label: id, deviceType: "generic", ports: [], ...data } });
const adapter = (id: string, hidden = false): SchematicNode => ({ ...device(id, { deviceType: "adapter", adapterVisibility: hidden ? "force-hide" : "force-show", ports: [{ id: "in", label: "XLR-5 In", direction: "input", signalType: "dmx" }, { id: "out", label: "XLR-3 Out", direction: "output", signalType: "dmx" }] }), hidden });
const panel = (id: string) => device(id, { deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] });
const connect = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string): ConnectionEdge => ({ id, source, sourceHandle, target, targetHandle, data: { signalType: "dmx" } });
const desk = device("desk", { label: "grandMA3 onPC", ports: [{ id: "out", label: "DMX OUT A", direction: "output", signalType: "dmx" }] });
const light = device("light", { label: "Remote fixture", ports: [{ id: "in", label: "DMX IN", direction: "input", signalType: "dmx" }] });

it.each([false, true])("follows chained adapters regardless of visibility (%s)", hidden => {
  const nodes = [desk, adapter("a", hidden), adapter("b", hidden), panel("pp")];
  const edges = [connect("desk-a", "desk", "out", "a", "in"), connect("a-b", "a", "out", "b", "in"), connect("b-pp", "b", "out", "pp", "p-front")];
  const row = computePatchPanelSchedule(nodes, edges)[0];
  expect(row.frontRemoteDevice).toBe("b");
  expect(row.frontOriginDevice).toBe("grandMA3 onPC");
  expect(row.frontOriginPort).toBe("DMX OUT A");
});

it("resolves both endpoints across virtual hops while retaining face mapping and direct neighbors", () => {
  const nodes = [desk, adapter("near"), adapter("far"), light, panel("pp1"), panel("pp2")];
  const circuit = { ...connect("circuit", "near", "out", "far", "in"), data: { signalType: "dmx", patchHops: [{ panelNodeId: "pp1", portId: "p", entryFace: "front" as const }, { panelNodeId: "pp2", portId: "p" }] } };
  const edges = [connect("desk-near", "desk", "out", "near", "in"), circuit, connect("far-light", "far", "out", "light", "in")];
  const rows = computePatchPanelSchedule(nodes, edges);
  const p1 = rows.find(r => r.panelId === "pp1")!;
  const p2 = rows.find(r => r.panelId === "pp2")!;
  expect(p1.frontRemoteDevice).toBe("near");
  expect(p1.frontOriginDevice).toBe("grandMA3 onPC");
  expect(p1.rearRemoteDevice).toBe("pp2");
  expect(p1.rearOriginDevice).toBe("Remote fixture");
  expect(p2.rearRemoteDevice).toBe("pp1");
  expect(p2.rearOriginDevice).toBe("grandMA3 onPC");
  expect(p2.frontOriginDevice).toBe("Remote fixture");
  expect(p2.frontOriginPort).toBe("DMX IN");
  expect(filterPatchPanelScheduleRows(rows, { filter: "DMX OUT A" })).toHaveLength(2);
  const csv = buildPatchPanelScheduleCsv(rows, "Show", "2026-11-17");
  expect(csv).toContain("Rear Origin Device,Rear Origin Port,Front Origin Device,Front Origin Port");
  expect(csv).toContain("grandMA3 onPC,DMX OUT A");
  const table = getPatchPanelScheduleTableData(rows, createDefaultPatchPanelScheduleLayout())[0];
  expect(table.rows.find(r => r.panel === "pp1")?.frontOriginDevice).toBe("grandMA3 onPC");
});

it("follows explicit panel passthrough and stops at active devices", () => {
  const nodes = [desk, panel("pp1"), panel("pp2")];
  const edges = [connect("desk-p1", "desk", "out", "pp1", "p-front"), connect("p1-p2", "pp1", "p-rear", "pp2", "p-rear")];
  const row = computePatchPanelSchedule(nodes, edges).find(r => r.panelId === "pp2")!;
  expect(row.rearRemoteDevice).toBe("pp1");
  expect(row.rearOriginDevice).toBe("grandMA3 onPC");
  expect(resolvePatchOrigin("desk", "out", "desk-p1", nodes, edges)).toMatchObject({ nodeId: "desk", handleId: "out", status: "resolved" });
});

it("supports legacy single-face panels and paired stub legs", () => {
  const nodes: SchematicNode[] = [desk, adapter("a"), device("pp", { deviceType: "patch-panel", ports: [{ id: "input", label: "DMX1", direction: "input", signalType: "dmx" }] }),
    { id: "s1", type: "stub-label", position: { x: 0, y: 0 }, data: { linkedConnectionId: "link", side: "source" } },
    { id: "s2", type: "stub-label", position: { x: 0, y: 0 }, data: { linkedConnectionId: "link", side: "target" } },
  ];
  const edges = [connect("a-pp", "a", "out", "pp", "input"), { ...connect("leg1", "desk", "out", "s1", "l"), data: { signalType: "dmx", linkedConnectionId: "link" } }, { ...connect("leg2", "s2", "r", "a", "in"), data: { signalType: "dmx", linkedConnectionId: "link" } }];
  const row = computePatchPanelSchedule(nodes, edges)[0];
  expect(row.remoteDevice).toBe("a");
  expect(row.originDevice).toBe("grandMA3 onPC");
  expect(row.originPort).toBe("DMX OUT A");
});

it("does not guess multi-port paths and terminates on open paths and cycles", () => {
  const a = adapter("a");
  expect(resolvePatchOrigin("a", "out", "incoming", [a], [])).toEqual({ status: "open" });
  const multi = device("multi", { deviceType: "adapter", ports: [...(a.data as DeviceData).ports, { id: "third", label: "3", direction: "output", signalType: "dmx" }] });
  expect(resolvePatchOrigin("multi", "out", "incoming", [multi], [])).toEqual({ status: "ambiguous" });
  const branched = [connect("one", "desk1", "out", "a", "in"), connect("two", "desk2", "out", "a", "in")];
  expect(resolvePatchOrigin("a", "out", "incoming", [a], branched)).toEqual({ status: "ambiguous" });
  const b = adapter("b");
  const cycle = [connect("ab", "a", "out", "b", "in"), connect("ba", "b", "out", "a", "in")];
  expect(resolvePatchOrigin("a", "in", "incoming", [a, b], cycle)).toEqual({ status: "loop" });
});


it("retains legacy-panel origins for direct plug attachments without inventing a cable", () => {
  const nodes = [desk, adapter("a"), device("pp", { deviceType: "patch-panel", ports: [{ id: "input", label: "DMX1", direction: "input", signalType: "dmx" }] })];
  const edges = [connect("desk-a", "desk", "out", "a", "in"), { ...connect("plug", "a", "out", "pp", "input"), data: { signalType: "dmx", directAttach: true } }];
  const row = computePatchPanelSchedule(nodes, edges)[0];
  expect(row.originDevice).toBe("grandMA3 onPC");
  expect(row.originPort).toBe("DMX OUT A");
  expect(row.cableId).toBe("");
  expect(row.cableLength).toBe("");
});
