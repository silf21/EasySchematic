import { afterEach, it, expect } from "vitest";
import { useSchematicStore as store } from "../store";
import type { SchematicNode } from "../types";

const initial = store.getState();
afterEach(() => store.setState(initial));
const room = (id: string, x: number, y: number, width: number, height: number): SchematicNode => ({ id, type: "room", position: { x, y }, style: { width, height }, data: { label: id }, zIndex: -1 });

it.each([true, false])("nests rooms independently of creation order (outer first: %s)", outerFirst => {
  store.setState({ nodes: [], edges: [] });
  const addOuter = () => store.getState().addRoom("Outer", { x: 0, y: 0 }, { width: 800, height: 600 });
  const addInner = () => store.getState().addRoom("Inner", { x: 96, y: 96 }, { width: 240, height: 160 });
  if (outerFirst) { addOuter(); addInner(); } else { addInner(); addOuter(); }
  const nodes = store.getState().nodes;
  const outer = nodes.find(n => n.data.label === "Outer")!;
  const inner = nodes.find(n => n.data.label === "Inner")!;
  expect(outer.parentId).toBeUndefined();
  expect(inner.parentId).toBe(outer.id);
  expect(inner.position).toEqual({ x: 96, y: 96 });
  expect(nodes.indexOf(outer)).toBeLessThan(nodes.indexOf(inner));
});

it("retains midpoint membership when the smaller room extends outside the outer bounds", () => {
  store.setState({ nodes: [room("outer", 0, 0, 800, 600), room("inner", -96, 96, 240, 160)], edges: [] });
  store.getState().reparentAllDevices({ skipUndo: true });
  expect(store.getState().nodes.find(n => n.id === "inner")?.parentId).toBe("outer");
  expect(store.getState().nodes.find(n => n.id === "inner")?.position).toEqual({ x: -96, y: 96 });
});

it("uses the larger room as parent for concentric rooms and leaves equal-size overlaps as peers", () => {
  store.setState({ nodes: [room("small", 200, 200, 200, 200), room("large", 0, 0, 600, 600), room("peer", 0, 0, 600, 600)], edges: [] });
  store.getState().reparentAllDevices({ skipUndo: true });
  const nodes = store.getState().nodes;
  expect(nodes.find(n => n.id === "small")?.parentId).toBe("large");
  expect(nodes.find(n => n.id === "large")?.parentId).toBeUndefined();
  expect(nodes.find(n => n.id === "peer")?.parentId).toBeUndefined();
});

it("reparents devices into the smallest room without changing absolute positions; undo restores hierarchy", () => {
  const device: SchematicNode = { id: "d", type: "device", position: { x: 150, y: 150 }, data: { label: "Device", deviceType: "generic", ports: [] } };
  store.setState({ nodes: [room("inner", 100, 100, 300, 300), room("outer", 0, 0, 800, 600), device], edges: [] });
  store.getState().reparentAllDevices();
  expect(store.getState().nodes.find(n => n.id === "d")?.parentId).toBe("inner");
  expect(store.getState().nodes.find(n => n.id === "d")?.position).toEqual({ x: 50, y: 50 });
  store.getState().undo();
  expect(store.getState().nodes.find(n => n.id === "inner")?.parentId).toBeUndefined();
  store.getState().redo();
  expect(store.getState().nodes.find(n => n.id === "inner")?.parentId).toBe("outer");
});
