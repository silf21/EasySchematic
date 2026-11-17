import { it, expect } from "vitest";
import { patchReferenceDisplay } from "../patchReferenceDisplay";
import { reconcilePatchReferences } from "../patchReferences";
import type { DeviceData, SchematicNode, ConnectionEdge } from "../types";

const panel: DeviceData = { label: "MZH Bächelacker Front Of House", shortName: "MZH FOH", useShortName: true, deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }], auxiliaryData: [{ text: "{{deviceType}}", position: "header" }, { text: "Festinstalliert", position: "header" }, { text: "{{hostname}}", position: "footer" }] };

it("uses the real panel's compact-name and auxiliary layout, keeping port centers on-grid", () => {
  const layout = patchReferenceDisplay(panel);
  expect(layout.label.text).toBe("MZH FOH");
  expect(layout.headerRows).toHaveLength(2);
  expect(layout.footerRows).toHaveLength(1);
  expect(layout.headerHeight).toBe(48);
  expect(layout.handleY).toBe(64);
  expect(layout.height).toBe(96);
  expect(layout.handleY % 16).toBe(0);
  expect(patchReferenceDisplay({ ...panel, auxiliaryData: [] }).height).toBe(64);
});

it("updates reference dimensions when the real panel's presentation changes", () => {
  const nodes = [{ id: "panel", type: "device", position: { x: 0, y: 0 }, data: panel }] as SchematicNode[];
  const edge = { id: "e", source: "panel", target: "panel", data: { signalType: "dmx", patchHops: [{ panelNodeId: "panel", portId: "p" }] } } as ConnectionEdge;
  const before = reconcilePatchReferences(nodes, [edge]);
  expect(before.find(n => n.type === "patch-reference")?.height).toBe(96);
  const after = reconcilePatchReferences(before.map(n => n.type === "device" ? { ...n, data: { ...n.data, auxiliaryData: [] } } : n), [edge]);
  expect(after.find(n => n.type === "patch-reference")?.height).toBe(64);
});

it("honors inherited and per-panel label wrapping without copying the full port list", () => {
  const full = { ...panel, useShortName: undefined, auxiliaryData: [] };
  expect(patchReferenceDisplay(full, { useShortNames: true }).label.text).toBe("MZH FOH");
  const layout = patchReferenceDisplay(full, { wrapDeviceLabels: true });
  expect(layout.label.wrapsInHeader).toBe(true);
  expect(layout.height % 16).toBe(0);
});
