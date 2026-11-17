import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readReportSort, reportSortKey, reportSortValue, sortReportBlocks, sortReportRows } from "../reportSort";
import { reportColumnId } from "../reportColumnOrder";
import { useSchematicStore as store } from "../store";
const initial = store.getState();
beforeEach(() => { const values = new Map<string, string>(); vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }); });
afterEach(() => { store.setState(initial); vi.unstubAllGlobals(); });

it("applies supplier/type/length priorities with natural numeric ordering and independent directions", () => {
  const rows = [
    { id: "a", supplier: "B", cableType: "XLR", cableLength: "2m" },
    { id: "b", supplier: "A", cableType: "XLR", cableLength: "10m" },
    { id: "c", supplier: "A", cableType: "XLR", cableLength: "2m" },
    { id: "d", supplier: "A", cableType: "Cat6", cableLength: "5m" },
  ];
  const rules = readReportSort([{ id: "supplier", direction: "asc" }, { id: "cabletype", direction: "asc" }, { id: "length", direction: "desc" }]);
  expect(sortReportRows(rows, rules).map(r => r.id)).toEqual(["d", "b", "c", "a"]);
  expect(rows.map(r => r.id)).toEqual(["a", "b", "c", "d"]);
});
it("sorts actual numeric values and keeps blanks last in either direction", () => {
  const rows = [{ unitCost: 2 }, { unitCost: undefined }, { unitCost: 10 }, { unitCost: 0 }];
  expect(sortReportRows(rows, [{ id: "unitcost", direction: "asc" }]).map(r => r.unitCost)).toEqual([0, 2, 10, undefined]);
  expect(sortReportRows(rows, [{ id: "unitcost", direction: "desc" }]).map(r => r.unitCost)).toEqual([10, 2, 0, undefined]);
});
it("retains existing tie order and validates imported priorities", () => {
  expect(sortReportRows([{ id: 2, supplier: "A" }, { id: 1, supplier: "A" }], [{ id: "supplier", direction: "asc" }]).map(r => r.id)).toEqual([2, 1]);
  expect(readReportSort([null, 5, { id: "x", direction: "asc", label: {} }, { id: "x", direction: "desc" }, { id: "y", direction: "wrong" }])).toEqual([{ id: "x", direction: "asc" }]);
  expect(reportSortValue({}, "__proto__")).toBe("");
});
it("keeps expansion cards attached to their parent and total rows at the end", () => {
  const rows = [{ model: "Z" }, { model: "A card", _isSubItem: "true" }, { model: "B" }, { model: "Total", _rowKind: "total" }];
  expect(sortReportBlocks(rows, [{ id: "device", direction: "asc" }]).map(r => r.model)).toEqual(["B", "Z", "A card", "Total"]);
});
it("keeps Model identity distinct from the manufacturer Model #", () => {
  expect(reportColumnId("Model")).toBe("model");
  expect(reportColumnId("Model #")).toBe("modelnumber");
  const row = { model: "Template model", modelNumber: "ABC-123" };
  expect(reportSortValue(row, "model")).toBe("Template model");
  expect(reportSortValue(row, "modelnumber")).toBe("ABC-123");
});
it("persists priorities and directions in project JSON", () => {
  store.setState({ nodes: [], edges: [], reportLayouts: {} });
  const rules = [{ id: "supplier", label: "Supplier", direction: "asc" }, { id: "length", label: "Length", direction: "desc" }];
  store.getState().setReportLayout(reportSortKey("cableSchedule"), rules);
  const file = JSON.parse(JSON.stringify(store.getState().exportToJSON()));
  store.setState({ reportLayouts: {} }); store.getState().importFromJSON(file);
  expect(readReportSort(store.getState().reportLayouts[reportSortKey("cableSchedule")])).toEqual(rules);
});

it("keeps the default primary sort on Shift-click and replaces it on ordinary clicks", async () => {
  const { toggleReportSort } = await import("../reportSort");
  const implicit = { id: "cableid", label: "Cable ID", direction: "asc" as const };
  const supplier = { id: "supplier", label: "Supplier" };
  expect(toggleReportSort([], supplier, true, implicit).map(r => r.id)).toEqual(["cableid", "supplier"]);
  expect(toggleReportSort([], supplier, false, implicit)).toEqual([{ ...supplier, direction: "asc" }]);
  expect(toggleReportSort([], { id: "cableid", label: "Cable ID" }, false, implicit)[0].direction).toBe("desc");
  expect(toggleReportSort([{ ...supplier, direction: "asc" }], { id: "cableid", label: "Cable ID" }, false, implicit)[0].direction).toBe("asc");
});
it("compares displayed PDF numbers and computed power totals consistently", async () => {
  const { reportSortDisplayValue } = await import("../reportSort");
  expect(reportSortDisplayValue("~1,200", "thermalbtuh")).toBe(1200);
  expect(reportSortDisplayValue("$12.50", "unitcost")).toBe(12.5);
  expect(reportSortDisplayValue("", "unitcost")).toBe(0);
  expect(reportSortDisplayValue("", "universe")).toBe("");
  expect(reportSortValue({ powerDrawW: 50, thermalBtuh: 170, count: 3 }, "totalw")).toBe(150);
  expect(reportSortValue({ powerDrawW: 50, thermalBtuh: 170, count: 3 }, "totalbtuh")).toBe(510);
});
