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

test("patched Ethernet labels stay on their section and its length editor changes only that section", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const fixture = { version: 47, name: "Patched Ethernet length", nodes: [
    ...["a", "b"].map((id, i) => ({ id, type: "device", position: { x: i * 1200, y: i * 320 }, data: { label: `Network ${id}`, deviceType: "generic", ports: [{ id: "lan", label: "LAN", direction: "bidirectional", signalType: "ethernet", connectorType: "rj45" }] } })),
    { id: "pp", type: "device", hidden: true, position: { x: 0, y: -400 }, data: { label: "Network Panel", deviceType: "patch-panel", offCanvas: true, ports: [{ id: "p", label: "LAN1", direction: "passthrough", signalType: "ethernet", frontConnectorType: "rj45", rearConnectorType: "rj45" }] } },
    { id: "patch-ref:lan:pp:p", type: "patch-reference", position: { x: 800, y: 320 }, data: { connectionId: "lan", panelNodeId: "pp", portId: "p" } },
  ], edges: [{ id: "lan", source: "a", target: "b", sourceHandle: "lan-out", targetHandle: "lan-in", type: "smoothstep", data: { signalType: "ethernet", cableId: "E008", cableLength: "99m", patchHops: [{ panelNodeId: "pp", portId: "p", entryFace: "rear" }], patchSegments: [{ cableLength: "10m" }, { cableLength: "20m" }] } }] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "patched-ethernet.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByLabel("Show cable lengths", { exact: true }).check();
  const label = page.locator('[data-testid="patch-section-label"][data-edge-id="lan:patch-section:0"]');
  await expect(label).toHaveText("E008-A · 10m");
  await expect.poll(() => label.evaluate(el => {
    const path = document.querySelector('.react-flow__edge[data-id="lan:patch-section:0"] .react-flow__edge-path') as SVGPathElement;
    const matrix = path?.getScreenCTM();
    if (!matrix) return 999;
    const box = el.getBoundingClientRect();
    const center = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix.inverse());
    const length = path.getTotalLength();
    let distance = Infinity;
    for (let i = 0; i <= 1000; i++) {
      const point = path.getPointAtLength(length * i / 1000);
      distance = Math.min(distance, Math.hypot(center.x - point.x, center.y - point.y));
    }
    return distance;
  })).toBeLessThan(3);
  await page.locator('.react-flow__edge[data-id="lan:patch-section:0"]').dispatchEvent("contextmenu", { button: 2, clientX: 600, clientY: 300 });
  await page.getByText("Set Cable Length...", { exact: true }).click();
  await expect(page.getByPlaceholder("e.g. 50 ft", { exact: true })).toHaveValue("10m");
  await page.getByPlaceholder("e.g. 50 ft", { exact: true }).fill("15m");
  await page.getByPlaceholder("e.g. 50 ft", { exact: true }).press("Enter");
  await expect(label).toHaveText("E008-A · 15m");
  await expect(page.locator('[data-testid="patch-section-label"][data-edge-id="lan:patch-section:1"]')).toHaveText("E008-B · 20m");
  await page.reload();
  await expect(label).toHaveText("E008-A · 15m");
});
