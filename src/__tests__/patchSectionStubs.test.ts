import { it, expect } from "vitest";
import { routeAllEdges } from "../edgeRouter";
import type { ConnectionEdge, SchematicNode } from "../types";
import type { HandleSnapshot } from "../routing/handleSnapshot";

it("routes only the two tails of a stubbed section, leaving no invisible spanning segment", () => {
  const nodes = ["a", "b"].map((id, i) => ({ id, type: "patch-reference", position: { x: i * 640, y: 0 }, measured: { width: 144, height: 64 }, data: { connectionId: "c", panelNodeId: id, portId: "p" } })) as SchematicNode[];
  const handles: HandleSnapshot = Object.fromEntries(nodes.map((node, i) => [node.id, { type: "patch-reference", positionAbsolute: node.position, source: [{ id: i ? "front" : "rear", x: i ? -5 : 139, y: 43, width: 10, height: 10 }], target: [] }]));
  const edge = { id: "section", source: "a", target: "b", sourceHandle: "rear", targetHandle: "front", data: { signalType: "dmx", cableId: "D1-B", patchSectionStubbed: true } } as ConnectionEdge;
  const route = routeAllEdges(nodes, [edge], handles).routes.section;
  expect(route.svgPath.match(/M /g)).toHaveLength(2);
  expect(route.segments).toHaveLength(2);
  expect(route.segments.every(s => Math.abs(s.x2 - s.x1) === 64 && s.y1 === s.y2)).toBe(true);
  expect(route.crossingPoints).toEqual([]);
});
