import { test, expect } from "@playwright/test";

const fixture = {
  version: 48, name: "Patch export regression", printPaperId: "iso-a4", printScale: 0.8, nodes: [
    { id: "desk", type: "device", position: { x: 16, y: 16 }, data: { label: "DMX Desk", deviceType: "generic", ports: [{ id: "out", label: "DMX OUT", direction: "output", signalType: "dmx" }] } },
    { id: "target", type: "device", position: { x: 768, y: 16 }, data: { label: "Remote Device", deviceType: "generic", ports: [{ id: "in", label: "DMX IN", direction: "input", signalType: "dmx" }] } },
    ...["FOH", "Stage"].map(id => ({ id, type: "device", hidden: true, position: { x: 16, y: 256 }, data: { label: id, deviceType: "patch-panel", offCanvas: true, ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } })),
  ], edges: [{ id: "dmx", source: "desk", sourceHandle: "out", target: "target", targetHandle: "in", data: { signalType: "dmx", cableId: "D001", supplier: "Rental", patchHops: [{ panelNodeId: "FOH", portId: "p", entryFace: "front" }, { panelNodeId: "Stage", portId: "p", entryFace: "rear" }], patchSegments: [{ cableLength: "10m", supplier: "Supplier A" }, { supplier: "Festinstalliert" }, { cableLength: "3m", supplier: "Supplier B" }] } }],
};

test("repeated page PDF exports retain patch assignments, section properties and reference positions after reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "patched.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByTestId("patch-reference")).toHaveCount(2);
  await page.locator(".react-flow__controls-fitview").click();
  await page.locator('.react-flow__node[data-id="desk"]').click();
  const positions = await page.locator(".react-flow__node-patch-reference").evaluateAll(nodes => nodes.map(n => (n as HTMLElement).style.transform));
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export as PDF", exact: true }).click();
    const pdf = await downloaded;
    await pdf.saveAs(test.info().outputPath(`patch-export-${i + 1}.pdf`));
    await expect(page.getByTestId("patch-reference")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge-patch-reference-edge")).toHaveCount(3);
    await expect(page.locator('.react-flow__node[data-id="desk"]')).toHaveClass(/selected/);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("easyschematic-autosave")!).edges[0].data)).toEqual(fixture.edges[0].data);
  }
  await page.reload();
  await expect(page.getByTestId("patch-reference")).toHaveCount(2);
  expect(await page.locator(".react-flow__node-patch-reference").evaluateAll(nodes => nodes.map(n => (n as HTMLElement).style.transform))).toEqual(positions);
  expect(errors).toEqual([]);
});
