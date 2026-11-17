import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("supplier PDF and preview wrap long rows and use the same page count", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  const fixture = { version: 48, name: "Supplier material export", nodes: [
    { id: "room", type: "room", position: { x: 0, y: 0 }, style: { width: 900, height: 900 }, data: { label: "Technikturm Front of House / Nebenbühne Rechts" } },
    ...Array.from({ length: 35 }, (_, i) => ({ id: `d${i}`, type: "device", position: { x: 32, y: 32 }, data: { label: `grandMA3 onPC FOH – Command Wing + Intel NUC Complete Controller Package ${i + 1}`, deviceType: "generic", ports: [], supplier: i < 15 ? "Eventtechnik by HOHL" : "TV / Stefan Müller", unitCost: 12.5 } })),
  ], edges: [] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "supplier.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "suppliers" })));
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Print Preview" })).toBeVisible();
  await page.getByRole("button", { name: "Portrait", exact: true }).click();
  await page.getByRole("combobox").last().waitFor();
  const preview = page.locator("div.fixed.inset-0.z-50").last();
  await preview.locator("select").first().selectOption("a4");
  const row = page.getByTestId("report-preview-row").first();
  await expect(row).toBeVisible();
  const material = row.locator(":scope > div").nth(2);
  expect(await material.locator(":scope > div").count()).toBeGreaterThan(1);
  expect(await material.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  // Wait for the same embedded font used by the PDF to settle the preview metrics.
  await page.evaluate(() => document.fonts.ready);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const download = await downloadPromise;
  const pdf = await readFile((await download.path())!);
  const pages = [...pdf.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
  expect(pages).toBeGreaterThan(1);
  await expect(page.getByText(`1 / ${pages}`, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
