import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const cables = [
  { supplier: "B", connector: "xlr-3", length: "2m" },
  { supplier: "A", connector: "xlr-3", length: "10m" },
  { supplier: "A", connector: "xlr-3", length: "2m" },
  { supplier: "A", connector: "rj45", length: "5m" },
  { supplier: "B", connector: "rj45", length: "1m" },
  { supplier: "A", connector: "xlr-3", length: "2m" },
];
const ports = (direction: string) => cables.map((c, i) => ({ id: `p${i}`, label: `DMX ${i}`, direction, signalType: "dmx", connectorType: c.connector }));
const fixture = { version: 48, name: "Multi-sort", nodes: [
  { id: "s", type: "device", position: { x: 64, y: 64 }, data: { label: "Source", model: "Template type", modelNumber: "ABC-123", deviceType: "generic", ports: ports("output") } },
  { id: "t", type: "device", position: { x: 400, y: 64 }, data: { label: "Target", deviceType: "generic", ports: ports("input") } },
], edges: cables.map((c, i) => ({ id: `e${i}`, source: "s", target: "t", sourceHandle: `p${i}`, targetHandle: `p${i}`, data: { signalType: "dmx", cableId: `D00${i + 1}`, cableLength: c.length, supplier: c.supplier } })) };

test("multi-level sorting persists, edits the right row and is shared with PDF and CSV", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "sort.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "cableSchedule" })));
  const table = page.locator('[data-report-table="cableSchedule"]');
  const ids = async () => table.locator("tbody tr").evaluateAll(rows => rows.map(row => row.querySelectorAll("td")[1].textContent?.trim()));
  await table.getByRole("columnheader", { name: "Supplier", exact: true }).click();
  await table.getByRole("columnheader", { name: "Cable Type", exact: true }).click({ modifiers: ["Shift"] });
  await table.getByRole("columnheader", { name: "Length", exact: true }).click({ modifiers: ["Shift"] });
  await table.getByRole("columnheader", { name: /^Length/ }).click({ modifiers: ["Shift"] });
  const expected = ["D004", "D002", "D003", "D006", "D005", "D001"];
  await expect.poll(ids).toEqual(expected);
  const menu = page.getByTestId("sort-priority-cableSchedule");
  await menu.locator("summary").click();
  await expect(menu.getByLabel("Sort column 1", { exact: true })).toHaveValue("supplier");
  await expect(menu.getByLabel("Sort column 2", { exact: true })).toHaveValue("cabletype");
  await expect(menu.getByLabel("Sort direction 3", { exact: true })).toHaveValue("desc");
  await menu.getByRole("button", { name: "Increase priority 3", exact: true }).click();
  await expect.poll(ids).toEqual(["D002", "D004", "D003", "D006", "D001", "D005"]);
  await menu.getByRole("button", { name: "Decrease priority 2", exact: true }).click();
  await expect.poll(ids).toEqual(expected);
  await menu.locator("summary").click();
  const row = table.locator("tbody tr").filter({ hasText: "D004" });
  await row.locator("td").nth(4).click(); await page.keyboard.press("Enter");
  await row.locator("td").nth(4).locator("input").fill("7m");
  await row.locator("td").nth(4).locator("input").press("Enter");
  await expect(row.locator("td").nth(4)).toHaveText("7m");
  await page.reload(); await expect(page.locator(".react-flow")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "cableSchedule" })));
  await expect.poll(ids).toEqual(expected);
  await expect(table.locator("tbody tr").filter({ hasText: "D004" }).locator("td").nth(4)).toHaveText("7m");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csv = await readFile((await (await csvDownload).path())!, "utf8");
  expect(csv.split(/\r?\n/).filter(line => /^D00\d,/.test(line)).map(line => line.split(",")[0])).toEqual(expected);
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Print Preview" })).toBeVisible();
  await expect(page.getByTestId("report-preview-row").first()).toContainText("D004");
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (await pdfDownload).saveAs(test.info().outputPath("multi-sort.pdf"));
  expect(errors).toEqual([]);
});
