import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { jsPDF } from "jspdf";
import { createSupplierLayout, supplierTableData, type SupplierMaterialRow } from "../supplierReport";
import { createReportTextMetrics, renderReportPdf, reportRowLayout } from "../reportPdf";
import { getPageDimensions, getTableColumnGapMm, getVisibleColumns, REPORT_MARGIN_MM, resolveLayout } from "../reportLayout";
import type { TitleBlock } from "../types";

const saved: jsPDF[] = [];
vi.mock("jspdf", async importOriginal => {
  const actual = await importOriginal<typeof import("jspdf")>();
  class CapturingJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      vi.spyOn(this, "text");
      this.save = (() => { saved.push(this); return this; }) as typeof this.save;
    }
  }
  return { ...actual, jsPDF: CapturingJsPDF };
});
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (url: string) => new Response(readFileSync(resolve(__dirname, "../../public", url.replace(/^\//, ""))))) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

const material = "grandMA3 onPC FOH – Command Wing + Intel NUC Complete Controller Package";
const route = "Technikturm Front of House > Nebenbühne Rechts / Remote Stage Installation";
const rows: SupplierMaterialRow[] = Array.from({ length: 45 }, (_, i) => ({ supplier: i < 20 ? "Eventtechnik by HOHL" : "TV / Stefan Müller", category: "Devices", material: `${material} ${i + 1}`, room: route, count: 1, unitCost: 12.5, cost: 12.5 }));

it("wraps full material names and routes using embedded PDF metrics, including saved narrow layouts", async () => {
  const defaults = createSupplierLayout();
  const savedLayout = { ...defaults, paperSize: "a4" as const, orientation: "portrait" as const, tables: defaults.tables.map(t => ({ ...t, wrapText: undefined })) };
  const layout = resolveLayout(defaults, savedLayout);
  expect(layout.tables[0].wrapText).toBe(true);
  const metrics = await createReportTextMetrics();
  const width = getPageDimensions(layout.paperSize, layout.orientation).widthMm - 2 * REPORT_MARGIN_MM;
  const table = layout.tables[0];
  const data = supplierTableData(rows)[0];
  const result = reportRowLayout(metrics, table, data.rows[0], width);
  expect(result.heightMm).toBeGreaterThan(6);
  const columns = getVisibleColumns(table, width, getTableColumnGapMm(table, width));
  for (const key of ["material", "room"]) {
    const i = columns.findIndex(c => c.key === key);
    expect(result.lines[i].join("").replace(/\s/g, "")).toBe(data.rows[0][key].replace(/\s/g, ""));
    expect(result.lines[i].every(line => metrics.getTextWidth(line) <= columns[i].widthMm)).toBe(true);
  }
  expect(data.rows.filter(r => r._rowKind === "subtotal")).toHaveLength(2);
  expect(data.rows.at(-1)?._rowKind).toBe("total");
});

it("exports a multi-page PDF with full text, repeated headers and rows above the footer", async () => {
  const layout = createSupplierLayout();
  layout.paperSize = "a4";
  layout.orientation = "portrait";
  await renderReportPdf(layout, { showName: "Supplier PDF verification" } as TitleBlock, supplierTableData(rows), "supplier-test.pdf");
  const doc = saved.at(-1)!;
  expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  const calls = vi.mocked(doc.text).mock.calls;
  const text = calls.map(call => String(call[0])).join("").replace(/\s/g, "");
  expect(text).toContain(material.replace(/\s/g, ""));
  expect(text).toContain(route.replace(/\s/g, ""));
  expect(text).not.toContain("…");
  expect(calls.filter(call => call[0] === "Material")).toHaveLength(doc.getNumberOfPages());
  const bottom = 297 - REPORT_MARGIN_MM - layout.footerHeightMm - 2;
  for (const call of calls.filter(call => String(call[0]).includes("grandMA3"))) expect(Number(call[2])).toBeLessThan(bottom);
  if (process.env.PDF_TEST_OUTPUT) writeFileSync(process.env.PDF_TEST_OUTPUT, Buffer.from(doc.output("arraybuffer")));
});
