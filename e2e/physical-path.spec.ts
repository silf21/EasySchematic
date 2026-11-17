import { test, expect } from "@playwright/test";

const fixture = {
  version: 46, name: "Distributed patch references", pages: [{ id: "patchbay-1", type: "patch-panel", label: "Patch Bay" }],
  nodes: [
    { id: "desk", type: "device", position: { x: 0, y: 0 }, data: { label: "DMX Desk", deviceType: "generic", ports: [1, 2].map(i => ({ id: `out${i}`, label: `DMX${i}`, direction: "output", signalType: "dmx", connectorType: "xlr-3" })) } },
    { id: "fixture", type: "device", position: { x: 1000, y: 0 }, data: { label: "Fixture", deviceType: "generic", ports: [1, 2].map(i => ({ id: `in${i}`, label: `DMX${i}`, direction: "input", signalType: "dmx", connectorType: "xlr-3" })) } },
    ...["PP1", "PP2"].map(id => ({ id, type: "device", hidden: true, position: { x: 0, y: -400 }, data: { label: id, deviceType: "patch-panel", offCanvas: true, supplier: "Festinstalliert", ports: [1, 2].map(i => ({ id: `p${i}`, label: `DMX${i}`, direction: "passthrough", signalType: "dmx", rearConnectorType: "xlr-5", frontConnectorType: "xlr-3" })) } })),
  ],
  edges: [1, 2].map(i => ({ id: `dmx${i}`, source: "desk", target: "fixture", sourceHandle: `out${i}`, targetHandle: `in${i}`, type: "smoothstep", data: { signalType: "dmx", cableId: `D00${i}`, supplier: "Rental", patchHops: [{ panelNodeId: "PP1", portId: `p${i}`, entryFace: "front" }, { panelNodeId: "PP2", portId: `p${i}` }], patchSegments: [{ cableLength: "10m" }, { supplier: "Festinstalliert" }, {}] } })),
};

test("distributed references route to physical faces, remain independently movable, and flip directly in Patch Bay", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "references.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  await expect(page.getByTestId("patch-reference").first()).toHaveCSS("width", "144px");
  await expect(page.getByTestId("patch-reference").first()).toHaveCSS("height", "64px");
  await expect(page.getByTestId("patch-reference").first()).toHaveCSS("border-style", "dashed");
  await expect(page.locator(".react-flow__edge-patch-reference-edge")).toHaveCount(6);
  // Measure actual rendered centers in flow coordinates, including border offsets.
  await expect.poll(() => page.locator('.react-flow__node-patch-reference .react-flow__handle').evaluateAll(handles => {
    const viewport = document.querySelector('.react-flow__viewport')!;
    const matrix = new DOMMatrix(getComputedStyle(viewport).transform);
    const pane = viewport.parentElement!.getBoundingClientRect();
    return handles.every(handle => {
      const r = handle.getBoundingClientRect();
      const x = ((r.left + r.width / 2) - pane.left - matrix.e) / matrix.a;
      const y = ((r.top + r.height / 2) - pane.top - matrix.f) / matrix.d;
      return Math.abs(x / 16 - Math.round(x / 16)) < 0.01 && Math.abs(y / 16 - Math.round(y / 16)) < 0.01;
    });
  })).toBe(true);
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByLabel("Show cable lengths", { exact: true }).check();
  await expect(page.getByText(/D001-A · 10m/, { exact: true })).toBeVisible();
  await page.getByLabel("Show cable IDs", { exact: true }).uncheck();
  await expect(page.getByText("10m", { exact: true })).toHaveCount(2);
  await page.getByLabel("Show cable lengths", { exact: true }).uncheck();
  await expect(page.getByText("10m", { exact: true })).toHaveCount(0);
  await page.getByLabel("Show cable IDs", { exact: true }).check();
  await page.getByRole("button", { name: "Collapse", exact: true }).click();
  const refs = page.locator('.react-flow__node-patch-reference');
  const first = refs.nth(0);
  const before = await first.getAttribute("style");
  const secondBefore = await refs.nth(1).getAttribute("style");
  const box = await first.boundingBox();
  if (!box) throw new Error("Reference not visible");
  await page.mouse.move(box.x + 30, box.y + 10);
  await page.mouse.down(); await page.mouse.move(box.x + 50, box.y - 54, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => first.getAttribute("style")).not.toBe(before);
  expect(await refs.nth(1).getAttribute("style")).toBe(secondBefore);
  const saved = await first.getAttribute("style");
  await page.reload();
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  await expect.poll(() => page.locator('.react-flow__node-patch-reference').nth(0).getAttribute("style")).toBe(saved);
  await page.getByTestId("patch-reference").first().dblclick();
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
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "cableSchedule" })));
  await expect(page.getByRole("button", { name: "Cable Schedule", exact: true })).toBeVisible();
  await expect(page.locator('input[value="Venue Rental"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});


test("stubs only the selected patch section and restores it after reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "references.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  // Only the middle physical section is cut; the canonical connection survives reload/undo.
  const middle = page.locator('.react-flow__edge-patch-reference-edge[data-id="dmx1:patch-section:1"]');
  await middle.dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 280 });
  await page.getByText("Stub Connection", { exact: true }).click();
  await expect(page.getByTestId("patch-section-stub")).toHaveCount(2);
  await expect(page.getByTestId("patch-section-stub").first()).toContainText("PP2 [DMX1 · rear]");
  await expect(page.getByTestId("patch-section-stub").nth(1)).toContainText("PP1 [DMX1 · rear]");
  await page.reload();
  await expect(page.getByTestId("patch-section-stub")).toHaveCount(2);
  await page.getByTestId("patch-section-stub").first().dispatchEvent("contextmenu", { button: 2, clientX: 450, clientY: 280 });
  await page.getByText("Show Full Connection", { exact: true }).click();
  await expect(page.getByTestId("patch-section-stub")).toHaveCount(0);
  await expect(page.locator(".react-flow__edge-patch-reference-edge")).toHaveCount(6);
});

test("panel references mirror the real panel's name and auxiliary fields", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  const mirrored = { ...fixture, nodes: fixture.nodes.map(n => n.id === "PP1" ? { ...n, hidden: false, data: { ...n.data, offCanvas: false, shortName: "MZH FOH", useShortName: true, supplier: "Festinstalliert", hostname: "panel-foh-01", auxiliaryData: [{ text: "{{deviceType}}", position: "header" }, { text: "Festinstalliert", position: "header" }, { text: "{{hostname}}", position: "footer" }] } } : n) };
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "panel-display.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(mirrored)) });
  const reference = page.locator('.react-flow__node[data-id="patch-ref:dmx1:PP1:p1"]');
  await expect(reference.getByText("MZH FOH", { exact: true })).toBeVisible();
  await expect(reference.getByText("Patch Panel", { exact: true })).toBeVisible();
  await expect(reference.getByText("Festinstalliert", { exact: true })).toBeVisible();
  await expect(reference.getByText("panel-foh-01", { exact: true })).toBeVisible();
  await expect(reference.getByTestId("patch-reference")).toHaveCSS("height", "96px");
  await expect.poll(() => reference.locator('.react-flow__handle').first().evaluate(handle => {
    const box = handle.getBoundingClientRect();
    const node = handle.closest('.react-flow__node')!.getBoundingClientRect();
    const scale = node.width / 144;
    return Math.round((box.top + box.height / 2 - node.top) / scale);
  })).toBe(64);
  await reference.screenshot({ path: test.info().outputPath("panel-reference-display.png") });
  await page.reload();
  await expect(reference.getByText("MZH FOH", { exact: true })).toBeVisible();
  await expect(reference.getByText("panel-foh-01", { exact: true })).toBeVisible();
});

test("each physical patch section has independent cable properties", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles({ name: "sections.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const open = async (index: number) => {
    await page.locator(`.react-flow__edge[data-id="dmx1:patch-section:${index}"]`).dispatchEvent("contextmenu", { button: 2, clientX: 500, clientY: 250 });
    return page.getByTestId("patch-section-properties");
  };
  let properties = await open(0);
  await expect(properties).toContainText("Patch section A");
  await properties.getByLabel("Section cable ID", { exact: true }).fill("FOH-Cable");
  await properties.getByLabel("Section cable length", { exact: true }).fill("10m");
  await properties.getByLabel("Supplier", { exact: true }).fill("Supplier A");
  await properties.getByLabel("Section unit cost", { exact: true }).fill("12.50");
  await page.keyboard.press("Escape");
  properties = await open(2);
  await expect(properties.getByLabel("Supplier", { exact: true })).toHaveValue("Rental");
  await properties.getByLabel("Section cable length", { exact: true }).fill("20m");
  await properties.getByLabel("Supplier", { exact: true }).fill("Supplier B");
  await properties.getByLabel("Section unit cost", { exact: true }).fill("25");
  await page.keyboard.press("Escape");
  properties = await open(1);
  await expect(properties.getByLabel("Supplier", { exact: true })).toHaveValue("Festinstalliert");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("patch-reference")).toHaveCount(4);
  properties = await open(0);
  await expect(properties.getByLabel("Section cable ID", { exact: true })).toHaveValue("FOH-Cable");
  await expect(properties.getByLabel("Section cable length", { exact: true })).toHaveValue("10m");
  await expect(properties.getByLabel("Supplier", { exact: true })).toHaveValue("Supplier A");
  await expect(properties.getByLabel("Section unit cost", { exact: true })).toHaveValue("12.5");
});
