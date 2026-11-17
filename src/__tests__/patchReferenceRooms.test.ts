import { afterEach, expect, it } from "vitest";
import { useSchematicStore as store } from "../store";
import { parentOffsetFromMap } from "../snapUtils";
import type { ConnectionEdge, SchematicNode } from "../types";

const initial = store.getState();
afterEach(() => store.setState(initial));
const room = (id: string, x: number, width = 400): SchematicNode => ({ id, type: "room", position: { x, y: 0 }, style: { width, height: 400 }, data: { label: id } });
const panel: SchematicNode = { id: "panel", type: "device", position: { x: -500, y: -500 }, data: { label: "Panel", deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } };
const edge = (id: string): ConnectionEdge => ({ id, source: "panel", target: "panel", data: { signalType: "dmx", patchHops: [{ panelNodeId: "panel", portId: "p" }] } }) as ConnectionEdge;
const refs = () => store.getState().nodes.filter(n => n.type === "patch-reference");

it("assigns each distributed reference its own room, including compact references", () => {
  store.setState({ nodes: [room("a", 3), room("b", 803), panel], edges: [edge("one"), { ...edge("two"), data: { ...edge("two").data!, showPatchReferences: false } }] });
  const [one, two] = refs();
  store.getState().reparentNode(one.id, { x: 32, y: 96 }, { skipUndo: true });
  store.getState().reparentNode(two.id, { x: 832, y: 96 }, { skipUndo: true });
  expect(refs().map(n => n.parentId)).toEqual(["a", "b"]);
  expect(refs()[1].hidden).toBe(true);
  store.setState({ nodes: store.getState().nodes.map(n => n.id === "a" ? { ...n, position: { x: 163, y: 0 } } : n) });
  store.getState().reparentAllDevices({ skipUndo: true });
  const nodes = store.getState().nodes;
  const offsets = refs().map(n => parentOffsetFromMap(n, new Map(nodes.map(n => [n.id, n]))));
  expect(refs()[0].position.x + offsets[0].dx).toBe(192);
  expect(refs()[1].position.x + offsets[1].dx).toBe(832);
  store.getState().reparentNode(one.id, { x: 1600, y: 96 }, { skipUndo: true });
  expect(refs()[0].parentId).toBeUndefined();
});

it("parents newly generated references by their center and retains off-grid room offsets", () => {
  const source = { ...panel, position: { x: 0, y: 0 } };
  store.setState({ nodes: [room("outer", 3, 800), { ...room("inner", 163, 300), position: { x: 163, y: 100 }, style: { width: 300, height: 200 } }, source], edges: [edge("new")] });
  expect(refs()[0].parentId).toBe("inner");
  const ref = refs()[0];
  const map = new Map(store.getState().nodes.map(n => [n.id, n]));
  const offset = parentOffsetFromMap(ref, map);
  expect((ref.position.x + offset.dx) % 16).toBe(0);
  store.setState({ nodes: [...store.getState().nodes] });
  expect(refs()[0].position).toEqual(ref.position);
});
