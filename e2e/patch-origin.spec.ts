import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("patch report exposes origin endpoints separately from the direct adapter and exports them", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const fixture = { version: 48, name: "Origin Devices", nodes: [
    { id: "desk", type: "device", position: { x: 0, y: 0 }, data: { label: "grandMA3 onPC", deviceType: "generic", ports: [{ id: "out", label: "DMX OUT A", direction: "output", signalType: "dmx" }] } },
    { id: "adapter", type: "device", position: { x: 200, y: 0 }, data: { label: "DMX5p M to 3p", deviceType: "adapter", ports: [{ id: "in", label: "XLR5 In", direction: "input", signalType: "dmx" }, { id: "out", label: "XLR3 Out", direction: "output", signalType: "dmx" }] } },
    { id: "fixture", type: "device", position: { x: 900, y: 0 }, data: { label: "Remote Fixture", deviceType: "generic", ports: [{ id: "in", label: "DMX IN", direction: "input", signalType: "dmx" }] } },
    ...["FOH", "Stage"].map(id => ({ id, type: "device", hidden: true, position: { x: 0, y: -400 }, data: { label: id, deviceType: "patch-panel", offCanvas: true, ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } })),
  ], edges: [
    { id: "desk-adapter", source: "desk", sourceHandle: "out", target: "adapter", targetHandle: "in", data: { signalType: "dmx" } },
    { id: "circuit", source: "adapter", sourceHandle: "out", target: "fixture", targetHandle: "in", data: { signalType: "dmx", patchHops: [{ panelNodeId: "FOH", portId: "p", entryFace: "front" }, { panelNodeId: "Stage", portId: "p" }] } },
  ] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "origin.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "patchPanel" })));
  await expect(page.getByRole("button", { name: "Patch Panels", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Columns ▾", exact: true }).click();
  await expect(page.getByLabel("Rear Origin Device", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Rear Origin Port", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Front Origin Device", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Front Origin Port", { exact: true })).toBeChecked();
  await page.locator("div.fixed.inset-0.z-40").click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole("cell", { name: "grandMA3 onPC", exact: true })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: "DMX OUT A", exact: true })).toHaveCount(2);
  await expect(page.getByRole("cell", { name: "DMX5p M to 3p", exact: true })).toHaveCount(1);
  await page.getByPlaceholder("Filter by panel, port, device, cable, signal, room...").fill("DMX OUT A");
  await expect(page.getByRole("cell", { name: "grandMA3 onPC", exact: true })).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  await (await download).saveAs(test.info().outputPath("patch-origins.csv"));
  const csv = readFileSync(test.info().outputPath("patch-origins.csv"), "utf8");
  expect(csv).toContain("Rear Origin Device,Rear Origin Port,Front Origin Device,Front Origin Port");
  expect(csv).toContain("grandMA3 onPC,DMX OUT A");
  expect(errors).toEqual([]);
});
