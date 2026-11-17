import { test, expect } from "@playwright/test";

test("auxiliary lighting previews use unsaved virtual channel configuration", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const fixture = { version: 48, name: "Preview", nodes: [{ id: "controller", type: "device", position: { x: 300, y: 100 }, data: {
    label: "Controller", deviceType: "generic", ports: [{ id: "p", label: "D1", direction: "output", signalType: "spi" }],
    virtualChannels: [{ id: "c", label: "Channel 2", portIds: ["p"], protocol: "artnet", outputSignal: "spi", config: { universe: 4, startAddress: 1 }, pixelCount: 300, channelsPerPixel: 3 }],
    auxiliaryData: [{ text: "{{virtualChannels}}", position: "footer" }, { text: "{{lightingPatch}}", position: "footer" }],
  } }], edges: [] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "preview.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('.react-flow__node[data-id="controller"]').dblclick();
  const aux = page.locator("details").filter({ has: page.locator("summary", { hasText: /^Auxiliary Data$/ }) });
  await aux.locator("summary").click();
  await expect(aux.getByText(/Channel 2 · Art-Net · U4 · Addr 1/)).toHaveCount(2);
  await page.getByLabel("Channel start universe", { exact: true }).fill("6");
  await expect(aux.getByText(/Channel 2 · Art-Net · U6 · Addr 1/)).toHaveCount(2);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator('.react-flow__node[data-id="controller"]').getByText(/Channel 2 · Art-Net · U6 · Addr 1/)).toHaveCount(2);
});
