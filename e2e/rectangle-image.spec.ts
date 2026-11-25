import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("rectangle image upload, fit, opacity, persistence and PDF embedding", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/"); await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "rectangle.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 48, name: "Rectangle background", nodes: [{ id: "r", type: "annotation", position: { x: 100, y: 100 }, style: { width: 400, height: 240 }, data: { shape: "rectangle", label: "Floor plan" } }], edges: [] })) });
  const node = page.locator('.react-flow__node[data-id="r"]'); await node.dblclick();
  const image = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 200; c.height = 100; const ctx = c.getContext("2d")!; ctx.fillStyle = "red"; ctx.fillRect(0, 0, 100, 100); ctx.fillStyle = "blue"; ctx.fillRect(100, 0, 100, 100); return c.toDataURL("image/png").split(",")[1]; });
  await page.getByLabel("Background image", { exact: true }).setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await expect(page.getByAltText("Background preview")).toBeVisible();
  await page.getByLabel("Image fit", { exact: true }).selectOption("cover");
  await page.getByLabel("Image opacity", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const background = page.getByTestId("rectangle-background-image");
  await expect(background).toHaveCSS("object-fit", "cover"); await expect(background).toHaveCSS("opacity", "0.6");
  await page.reload(); await expect(background).toHaveCSS("opacity", "0.6");
  await page.getByRole("button", { name: "Export", exact: true }).click(); const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export as PDF", exact: true }).click(); const pdf = await download;
  await pdf.saveAs(test.info().outputPath("rectangle-image.pdf"));
  expect((await readFile((await pdf.path())!)).toString("latin1")).toContain("/Subtype /Image");
  await node.dblclick(); await page.getByLabel("Image fit", { exact: true }).selectOption("fill"); await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(background).toHaveCSS("object-fit", "fill");
  await node.dblclick(); await page.getByRole("button", { name: "Remove image", exact: true }).click(); await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(background).toHaveCount(0); expect(errors).toEqual([]);
});
