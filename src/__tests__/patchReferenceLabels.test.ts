import { it, expect } from "vitest";
import { patchLabelPosition } from "../patchReferenceLabels";
it("places labels along the wire rather than in the empty center of an L route", () => {
  expect(patchLabelPosition([{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 240 }, { x: 800, y: 240 }], { x: 400, y: 120 })).toEqual({ x: 280, y: 240 });
});
it("handles duplicate points, reversed wires and unmeasured routes", () => {
  expect(patchLabelPosition([{ x: 100, y: 16 }, { x: 100, y: 16 }, { x: 0, y: 16 }], { x: 0, y: 0 })).toEqual({ x: 50, y: 16 });
  expect(patchLabelPosition([], { x: 7, y: 8 })).toEqual({ x: 7, y: 8 });
  expect(patchLabelPosition([{ x: 16, y: 16 }], { x: 0, y: 0 })).toEqual({ x: 16, y: 16 });
});
