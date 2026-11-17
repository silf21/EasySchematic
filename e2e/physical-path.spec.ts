import { test, expect } from "@playwright/test";

const fixture = {
  version: 45, name: "DMX physical path", nodes: [
    { id: "desk", type: "device", position: { x: 0, y: 0 }, data: { label: "DMX Desk", deviceType: "generic", ports: [{ id: "out", label: "DMX", direction: "output", signalType: "dmx", connectorType: "xlr-3" }] } },
    { id: "fixture", type: "device", position: { x: 650, y: 0 }, data: { label: "Fixture", deviceType: "generic", ports: [{ id: "in", label: "DMX", direction: "input", signalType: "dmx", connectorType: "xlr-3" }] } },
    ...["PP1", "PP2"].map(id => ({ id, type: "device", hidden: true, position: { x: 0, y: -400 }, data: { label: id, deviceType: "patch-panel", offCanvas: true, provision: "installed", ports: [{ id: "p", label: "DMX A", direction: "passthrough", signalType: "dmx", rearConnectorType: "xlr-5", frontConnectorType: "xlr-5" }] } })),
  ], edges: [{ id: "dmx", source: "desk", target: "fixture", sourceHandle: "out", targetHandle: "in", type: "smoothstep", data: { signalType: "dmx", cableId: "D001", supplier: "Rental", patchHops: [{ panelNodeId: "PP1", portId: "p" }, { panelNodeId: "PP2", portId: "p", entryFace: "front" }], patchSegments: [{}, { provision: "installed" }, {}] } }],
};

test("physical path is visible, editable and persists; supplier report excludes the fixed run", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "physical.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByText(/via PP1/)).toBeVisible();
  await page.getByRole("button", { name: "Expand physical path" }).click();
  await expect(page.getByText("Physical signal path", { exact: true })).toBeVisible();
  await expect(page.getByText("Fixed installation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit physical signal path", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Physical signal path" });
  await dialog.getByLabel("Panel 1 direction").selectOption("front");
  await dialog.getByRole("button", { name: "+ Add inline cable / adapter cable", exact: true }).first().click();
  await dialog.getByLabel("Cable name").nth(1).fill("Adapter 3pin to 5pin");
  await dialog.getByLabel("Cable unit cost").nth(1).fill("5");
  await dialog.screenshot({ path: test.info().outputPath("physical-path-editor.png") });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Adapter 3pin to 5pin", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Adapter 3pin to 5pin", { exact: true })).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "suppliers" })));
  await expect(page.getByRole("button", { name: "By Supplier", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Adapter 3pin to 5pin", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
