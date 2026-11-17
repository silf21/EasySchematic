import { test, expect } from "@playwright/test";

test("normal Ethernet connections show an explicitly entered cable length", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const fixture = { version: 47, name: "Ethernet length", nodes: ["a", "b"].map((id, i) => ({ id, type: "device", position: { x: i * 480, y: 0 }, data: { label: `Network ${id}`, deviceType: "generic", ports: [{ id: "lan", label: "LAN", direction: "bidirectional", signalType: "ethernet", connectorType: "rj45" }] } })), edges: [{ id: "lan", source: "a", target: "b", sourceHandle: "lan-out", targetHandle: "lan-in", type: "smoothstep", data: { signalType: "ethernet", cableId: "NET01", cableLength: "10m" } }] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "ethernet.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByLabel("Show cable lengths", { exact: true }).check();
  await expect(page.getByText("10m", { exact: true })).toBeVisible();
  await page.getByLabel("Show cable IDs", { exact: true }).uncheck();
  await expect(page.getByText("10m", { exact: true })).toBeVisible();
});
