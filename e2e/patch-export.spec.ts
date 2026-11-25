import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = {
  version: 48, name: "Patch export regression", printPaperId: "iso-a4", printScale: 0.8, nodes: [
    { id: "room", type: "room", position: { x: 64, y: 64 }, style: { width: 896, height: 336 }, data: { label: "Patch room" } },
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
    const contents = (await readFile((await pdf.path())!)).toString("latin1");
    expect(contents).not.toContain("/Subtype /Image");
    expect(contents).toContain("/Font");
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


test("vector export adds linked destinations to normal and multi-hop patch stubs without changing the schematic", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  const nodes = [
    ...fixture.nodes.map(n => n.id === "target" ? { ...n, position: { x: 2208, y: 112 } } : { ...n, position: { ...n.position, y: n.position.y + 96 } }),
    ...["FOH", "Stage"].map((panel, i) => ({ id: `patch-ref:dmx:${panel}:p`, type: "patch-reference", position: { x: i === 0 ? 320 : 1808, y: 256 }, data: { connectionId: "dmx", panelNodeId: panel, portId: "p" } })),
    { id: "near", type: "device", position: { x: 64, y: 400 }, data: { label: "Normal source", deviceType: "generic", ports: [{ id: "out", label: "DMX OUT", direction: "output", signalType: "dmx" }] } },
    { id: "far", type: "device", position: { x: 2208, y: 400 }, data: { label: "Normal destination", deviceType: "generic", ports: [{ id: "in", label: "DMX IN", direction: "input", signalType: "dmx" }] } },
  ];
  const edges = [
    { ...fixture.edges[0], data: { ...fixture.edges[0].data, patchSegments: [{ cableLength: "10m" }, { supplier: "Festinstalliert", stubbed: true }, { cableLength: "3m" }] } },
    { id: "ordinary", source: "near", sourceHandle: "out", target: "far", targetHandle: "in", data: { signalType: "dmx", cableId: "DX100" } },
  ];
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "references.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...fixture, nodes, edges })) });
  await expect(page.getByTestId("patch-section-stub")).toHaveCount(2);
  await page.locator('.react-flow__edge[data-id="ordinary"]').dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 280 });
  await page.getByText("Stub Connection", { exact: true }).click();
  await expect(page.locator("[data-pdf-stub-id]")).toHaveCount(2);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("easyschematic-autosave")!));
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export as PDF", exact: true }).click();
  const pdf = await downloaded;
  await pdf.saveAs(test.info().outputPath("linked-vector-schematic.pdf"));
  const contents = (await readFile((await pdf.path())!)).toString("latin1");
  expect(contents).not.toContain("/Subtype /Image");
  expect([...contents.matchAll(/\/Type \/Page\b/g)]).toHaveLength(2);
  expect([...contents.matchAll(/\/Subtype \/Link/g)].length).toBeGreaterThanOrEqual(4);
  const pageObjects = [...contents.matchAll(/(\d+) 0 obj\s*<<\s*\/Type \/Page\b/g)].map(match => match[1]);
  const destinations = [...contents.matchAll(/\/Dest \[(\d+) 0 R/g)].map(match => match[1]);
  expect(new Set(destinations)).toEqual(new Set(pageObjects));
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("easyschematic-autosave")!));
  expect(after.edges).toEqual(before.edges);
  expect(after.nodes.map((n: { id: string; position: unknown }) => [n.id, n.position])).toEqual(before.nodes.map((n: { id: string; position: unknown }) => [n.id, n.position]));
  expect(errors).toEqual([]);
});
