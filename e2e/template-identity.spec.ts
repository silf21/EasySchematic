import { test, expect } from "@playwright/test";

test("updating a user template refreshes the edited device's material identity", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const fixture = { version: 47, name: "Template identity", nodes: [{ id: "decoder", type: "device", position: { x: 0, y: 0 }, data: { label: "Original decoder", model: "Original decoder", deviceType: "generic", ports: [{ id: "input", label: "DMX In", direction: "input", signalType: "dmx" }] } }], edges: [] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "template.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const device = page.locator('.react-flow__node[data-id="decoder"]');
  await device.dblclick();
  const name = page.getByPlaceholder("e.g. Camera 1", { exact: true });
  await name.fill("User decoder");
  await page.getByRole("button", { name: "Save as User Template", exact: true }).click();
  await name.fill("Renamed decoder");
  await page.getByRole("button", { name: "More save and revert actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Update User Template", exact: true }).click();
  await device.dblclick();
  await expect(name).toHaveValue("Renamed decoder");
  await name.fill("Bühnenbild M 1/2");
  await expect(page.getByText("Template: Renamed decoder", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.reload();
  await device.dblclick();
  await expect(name).toHaveValue("Bühnenbild M 1/2");
  await expect(page.getByText("Template: Renamed decoder", { exact: true })).toBeVisible();
});
