import { test, expect } from "@playwright/test";

const fixture = {
  version: 46, name: "Distributed patch references", pages: [{ id: "patchbay-1", type: "patch-panel", label: "Patch Bay" }],
  nodes: [
    { id: "desk", type: "device", position: { x: 0, y: 0 }, data: { label: "DMX Desk", deviceType: "generic", ports: [1, 2].map(i => ({ id: `out${i}`, label: `DMX${i}`, direction: "output", signalType: "dmx", connectorType: "xlr-3" })) } },
    { id: "fixture", type: "device", position: { x: 1000, y: 0 }, data: { label: "Fixture", deviceType: "generic", ports: [1, 2].map(i => ({ id: `in${i}`, label: `DMX${i}`, direction: "input", signalType: "dmx", connectorType: "xlr-3" })) } },
    ...["PP1", "PP2"].map(id => ({ id, type: "device", hidden: true, position: { x: 0, y: -400 }, data: { label: id, deviceType: "patch-panel", offCanvas: true, supplier: "Festinstalliert", ports: [1, 2].map(i => ({ id: `p${i}`, label: `DMX${i}`, direction: "passthrough", signalType: "dmx", rearConnectorType: "xlr-5", frontConnectorType: "xlr-3" })) } })),
  ],
  edges: [1, 2].map(i => ({ id: `dmx${i}`, source: "desk", target: "fixture", sourceHandle: `out${i}`, targetHandle: `in${i}`, type: "smoothstep", data: { signalType: "dmx", cableId: `D00${i}`, supplier: "Rental", patchHops: [{ panelNodeId: "PP1", portId: `p${i}`, entryFace: "front" }, { panelNodeId: "PP2", portId: `p${i}` }], patchSegments: [{}, { supplier: "Festinstalliert" }, {}] } })),
};

test("distributed references route to physical faces, remain independently movable, and flip directly in Patch Bay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "references.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  await expect(page.locator(".react-flow__edge-patch-reference-edge")).toHaveCount(6);
  const refs = page.locator('.react-flow__node-patch-reference');
  const first = refs.nth(0);
  const before = await first.getAttribute("style");
  const secondBefore = await refs.nth(1).getAttribute("style");
  const box = await first.boundingBox();
  if (!box) throw new Error("Reference not visible");
  await page.mouse.move(box.x + 30, box.y + 10);
  await page.mouse.down(); await page.mouse.move(box.x + 50, box.y + 90, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => first.getAttribute("style")).not.toBe(before);
  expect(await refs.nth(1).getAttribute("style")).toBe(secondBefore);
  const saved = await first.getAttribute("style");
  await page.reload();
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  await expect.poll(() => page.locator('.react-flow__node-patch-reference').nth(0).getAttribute("style")).toBe(saved);
  await page.getByRole("button", { name: /Patch Bay/ }).click();
  const flip = page.getByTestId("flip-patch-face").first();
  await expect(flip).toContainText("Previous: Front");
  await flip.click();
  await expect(flip).toContainText("Previous: Rear");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Compact schematic", exact: true }).first().click();
  await page.getByRole("button", { name: "Schematic", exact: true }).click();
  await expect(page.getByTestId("patch-reference")).toHaveCount(2);
  await page.getByRole("button", { name: /Patch Bay/ }).click();
  await page.getByRole("button", { name: "Show panel references", exact: true }).first().click();
  await page.getByRole("button", { name: "Schematic", exact: true }).click();
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  await page.screenshot({ path: test.info().outputPath("distributed-patch-references.png") });
  await page.locator(".react-flow__edge-patch-reference-edge").first().dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 280 });
  const supplier = page.getByTestId("connection-context-menu").getByLabel("Supplier", { exact: true });
  await supplier.fill("Venue Rental");
  await expect(supplier).toHaveValue("Venue Rental");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "suppliers" })));
  await expect(page.getByRole("button", { name: "By Supplier", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Venue Rental · 2 items/ })).toBeVisible();
  expect(errors).toEqual([]);
});
