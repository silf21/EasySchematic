import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mergeVisibleColumnOrder, orderReportColumns, readReportColumnOrder, reportColumnId, reportColumnOrderKey } from "../reportColumnOrder";
import { useSchematicStore as store } from "../store";

const initial = store.getState();
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => { store.setState(initial); vi.unstubAllGlobals(); });
it("keeps saved order and appends newly introduced columns without mutating inputs", () => {
  const columns = ["id", "signal", "length", "new"];
  expect(orderReportColumns(columns, ["length", "id", "obsolete"], c => c)).toEqual(["length", "id", "signal", "new"]);
  expect(columns).toEqual(["id", "signal", "length", "new"]);
  expect(readReportColumnOrder(["id", 12, "id", "signal"])).toEqual(["id", "signal"]);
  expect(readReportColumnOrder({})).toEqual([]);
});
it("identifies headers independently of sorting arrows and punctuation", () => {
  expect(reportColumnId("Cable ID ▴")).toBe(reportColumnId("Cable ID"));
  expect(reportColumnId("Ext. Cost")).toBe("extcost");
});
it("retains the slots of hidden columns when visible columns are rearranged", () => {
  expect(mergeVisibleColumnOrder(["id", "hidden", "signal", "length"], ["id", "signal", "length"], ["length", "id", "signal"])).toEqual(["length", "hidden", "id", "signal"]);
});
it("persists independent report column preferences through project JSON export/import", () => {
  store.setState({ nodes: [], edges: [], reportLayouts: {} });
  store.getState().setReportLayout(reportColumnOrderKey("cableSchedule"), ["length", "cableid", "signal"]);
  store.getState().setReportLayout(reportColumnOrderKey("deviceReport"), ["device", "supplier"]);
  const file = JSON.parse(JSON.stringify(store.getState().exportToJSON()));
  store.setState({ reportLayouts: {} });
  store.getState().importFromJSON(file);
  expect(store.getState().reportLayouts[reportColumnOrderKey("cableSchedule")]).toEqual(["length", "cableid", "signal"]);
  expect(store.getState().reportLayouts[reportColumnOrderKey("deviceReport")]).toEqual(["device", "supplier"]);
});
