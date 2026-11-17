import type { ConnectionEdge, SchematicNode, SchematicPage } from "./types";
import { computePackList, cableUnitCost, csvRow } from "./packList";
import { supplierKey, supplierName } from "./suppliers";
import { createDefaultPackListLayout, type ReportLayout } from "./reportLayout";
import type { ReportTableData } from "./reportPdf";

export interface SupplierMaterialRow {
  supplier: string;
  category: string;
  material: string;
  room: string;
  count: number;
  unitCost: number;
  cost: number;
}
export function computeSupplierMaterials(nodes: SchematicNode[], edges: ConnectionEdge[], pages: SchematicPage[] = [], costs?: Record<string, number>): SupplierMaterialRow[] {
  const data = computePackList(nodes, edges, pages);
  const rows: SupplierMaterialRow[] = [];
  const add = (supplier: string | undefined, category: string, material: string, room: string, count: number, unitCost: number) => {
    rows.push({ supplier: supplierName(supplier) || "Unassigned", category, material, room, count, unitCost, cost: count * unitCost });
  };
  for (const d of data.devices) {
    add(d.supplier, "Devices", d.model, d.room, d.count, d.unitCost);
    for (const c of d.cards) add(d.supplier, "Expansion cards", c.cardLabel, d.room, c.count, c.cardUnitCost);
  }
  for (const c of data.summary) add(c.supplier, "Cables", `${c.cableType}${c.cableLength ? ` · ${c.cableLength}` : ""}`, c.route, c.count, cableUnitCost(c, costs));
  for (const a of data.accessories) add(a.supplier, "Accessories", a.model, a.room, a.count, a.unitCost ?? 0);
  for (const a of data.adapters) add(a.supplier, "Adapters", a.model, a.room, a.count, a.unitCost ?? 0);
  for (const r of data.racks) add(undefined, "Racks", r.label, r.room, r.count, r.unitCost);
  const names = new Map<string, string>();
  for (const row of rows) {
    const key = supplierKey(row.supplier);
    if (!names.has(key)) names.set(key, row.supplier);
    row.supplier = names.get(key)!;
  }
  return rows.sort((a, b) => a.supplier.localeCompare(b.supplier) || a.category.localeCompare(b.category) || a.material.localeCompare(b.material));
}

export function supplierGroups(rows: SupplierMaterialRow[]): { supplier: string; rows: SupplierMaterialRow[]; count: number; cost: number; unpriced: number }[] {
  const map = new Map<string, SupplierMaterialRow[]>();
  for (const row of rows) { const key = supplierKey(row.supplier); const group = map.get(key) ?? []; group.push(row); map.set(key, group); }
  return [...map.values()].map(rows => ({ supplier: rows[0].supplier, rows, count: rows.reduce((n, r) => n + r.count, 0), cost: rows.reduce((n, r) => n + r.cost, 0), unpriced: rows.filter(r => r.unitCost === 0).reduce((n, r) => n + r.count, 0) }));
}
export function supplierTableData(rows: SupplierMaterialRow[]): ReportTableData[] {
  const output: Record<string, string>[] = [];
  for (const g of supplierGroups(rows)) {
    for (const r of g.rows) output.push({ supplier: r.supplier, category: r.category, material: r.material, room: r.room, count: String(r.count), unitCost: r.unitCost ? r.unitCost.toFixed(2) : "", cost: r.cost ? r.cost.toFixed(2) : "" });
    output.push({ supplier: g.supplier, material: `SUBTOTAL (${g.unpriced} unpriced)`, count: String(g.count), cost: g.cost.toFixed(2) });
  }
  output.push({ supplier: "TOTAL", count: String(rows.reduce((n, r) => n + r.count, 0)), cost: rows.reduce((n, r) => n + r.cost, 0).toFixed(2) });
  return [{ id: "suppliers", rows: output }];
}
export function buildSupplierCsv(rows: SupplierMaterialRow[]): string {
  const keys = ["supplier", "category", "material", "room", "count", "unitCost", "cost"];
  return "\uFEFF" + [csvRow(["Supplier", "Category", "Material", "Room / Route", "Qty", "Unit Cost", "Cost"]), ...supplierTableData(rows)[0].rows.map(r => csvRow(keys.map(k => r[k] ?? "")))].join("\n");
}
export function createSupplierLayout(): ReportLayout {
  const layout = createDefaultPackListLayout();
  layout.headerLayout = { ...layout.headerLayout, cells: layout.headerLayout.cells.map(c => c.content.type === "static" && c.content.text === "Pack List" ? { ...c, content: { type: "static" as const, text: "Materials by Supplier" } } : c) };
  layout.tables = [{ id: "suppliers", label: "Materials by Supplier", groupBy: null, groupByOptions: [], sortBy: null, sortDir: "asc", columns: [
    { key: "supplier", header: "Supplier", widthMm: 28, visible: true },
    { key: "category", header: "Category", widthMm: 24, visible: true },
    { key: "material", header: "Material", widthMm: 60, visible: true },
    { key: "room", header: "Room / Route", widthMm: 28, visible: true },
    { key: "count", header: "Qty", widthMm: 12, visible: true },
    { key: "unitCost", header: "Unit Cost", widthMm: 20, visible: true },
    { key: "cost", header: "Cost", widthMm: 22, visible: true },
  ] }];
  layout.orientation = "landscape";
  return layout;
}
