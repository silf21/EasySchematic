import { afterEach, expect, it } from "vitest";
import { applyEdgeChanges } from "@xyflow/react";
import { canonicalPatchEdgeChanges, patchReferenceEdges } from "../patchReferences";
import { suspendExportSelection } from "../exportSelection";
import { useSchematicStore as store } from "../store";
import type { ConnectionEdge, SchematicNode } from "../types";

const initial = store.getState();
afterEach(() => store.setState(initial));
const nodes: SchematicNode[] = [
  { id: "source", type: "device", selected: true, position: { x: 0, y: 0 }, data: { label: "Desk", deviceType: "generic", ports: [] } },
  ...["a", "b"].map(id => ({ id, type: "device" as const, position: { x: 400, y: 0 }, data: { label: id, deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough" as const, signalType: "dmx" }] } })),
];
const connection: ConnectionEdge = { id: "wire", source: "source", target: "source", selected: true, data: { signalType: "dmx", cableId: "D001", supplier: "Rental", patchHops: [{ panelNodeId: "a", portId: "p", entryFace: "front" }, { panelNodeId: "b", portId: "p", entryFace: "rear" }], patchSegments: [{ cableLength: "10m", supplier: "A" }, { supplier: "Festinstalliert" }, { cableLength: "3m", supplier: "B", stubbed: true }] } };
function setup() {
  store.setState({ nodes: structuredClone(nodes), edges: [structuredClone(connection)] });
}

it("suspends and restores selection repeatedly without replacing patch connections or references", () => {
  setup();
  const before = store.getState();
  expect(before.nodes.filter(n => n.type === "patch-reference")).toHaveLength(2);
  for (let i = 0; i < 2; i++) {
    const restore = suspendExportSelection();
    expect(store.getState().edges[0].selected).toBe(false);
    expect(store.getState().edges[0].data).toBe(before.edges[0].data);
    expect(store.getState().nodes.filter(n => n.type === "patch-reference")).toEqual(before.nodes.filter(n => n.type === "patch-reference"));
    restore();
    restore(); // Browser afterprint and fallback can both run.
    expect(store.getState().edges).toEqual(before.edges);
    expect(store.getState().nodes).toEqual(before.nodes);
  }
});

it("rejects derived edge replacements from React Flow setEdges while forwarding selection", () => {
  setup();
  const state = store.getState();
  const drawn = patchReferenceEdges(state.nodes, state.edges);
  expect(drawn).toHaveLength(3);
  const changes = drawn.map(e => ({ type: "replace" as const, id: e.id, item: { ...e, selected: false } }));
  // The old ID-only mapping replaced the canonical edge with a drawing section.
  const safe = canonicalPatchEdgeChanges(changes, state.edges);
  const result = applyEdgeChanges(safe, state.edges);
  expect(result).toEqual([{ ...connection, selected: false }]);
  expect(result[0].data?.patchHops).toHaveLength(2);
  expect(result[0].data?.patchSegments?.[2].supplier).toBe("B");
  expect(canonicalPatchEdgeChanges([{ type: "add", item: drawn[0] }], state.edges)).toEqual([]);
  expect(canonicalPatchEdgeChanges([{ type: "remove", id: drawn[1].id }], state.edges)).toEqual([{ type: "remove", id: connection.id }]);
});

it("preserves ordinary replacements and never recreates removed connections on restoration", () => {
  setup();
  const replacement = { ...connection, data: { ...connection.data!, supplier: "Changed" } };
  expect(canonicalPatchEdgeChanges([{ type: "replace", id: connection.id, item: replacement }], [connection])).toEqual([{ type: "replace", id: connection.id, item: replacement }]);
  const restore = suspendExportSelection();
  store.setState({ nodes: [], edges: [] });
  restore();
  expect(store.getState().edges).toEqual([]);
  expect(store.getState().nodes).toEqual([]);
});
