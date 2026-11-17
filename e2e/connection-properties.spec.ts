import { test, expect } from "@playwright/test";

test("ordinary connections expose cable properties and retain edits after reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  const fixture = { version: 48, name: "Cable properties", nodes: [
    { id: "s", type: "device", position: { x: 64, y: 64 }, data: { label: "Source", deviceType: "generic", ports: [{ id: "p", label: "LAN", direction: "output", signalType: "ethernet", connectorType: "rj45" }] } },
    { id: "t", type: "device", position: { x: 500, y: 64 }, data: { label: "Target", deviceType: "generic", ports: [{ id: "p", label: "LAN", direction: "input", signalType: "ethernet", connectorType: "rj45" }] } },
  ], edges: [{ id: "cable", source: "s", target: "t", sourceHandle: "p", targetHandle: "p", data: { signalType: "ethernet", cableId: "E001" } }] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "cable.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const open = async () => page.locator('.react-flow__edge[data-id="cable"]').dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 280 });
  await open();
  const properties = page.getByTestId("connection-properties");
  await expect(properties.getByLabel("Cable ID", { exact: true })).toHaveValue("E001");
  await properties.getByLabel("Cable ID", { exact: true }).fill("LAN-42");
  await properties.getByLabel("Cable length", { exact: true }).fill("25m");
  await properties.getByLabel("Supplier", { exact: true }).fill("Rental");
  await properties.getByLabel("Unit cost", { exact: true }).fill("12.50");
  await page.keyboard.press("Escape");
  await expect(properties).toHaveCount(0);
  await page.reload(); await expect(page.locator(".react-flow")).toBeVisible();
  await open();
  await expect(properties.getByLabel("Cable ID", { exact: true })).toHaveValue("LAN-42");
  await expect(properties.getByLabel("Cable length", { exact: true })).toHaveValue("25m");
  await expect(properties.getByLabel("Supplier", { exact: true })).toHaveValue("Rental");
  await expect(properties.getByLabel("Unit cost", { exact: true })).toHaveValue("12.5");
  expect(errors).toEqual([]);
});
