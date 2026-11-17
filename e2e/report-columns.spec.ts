import { test, expect } from "@playwright/test";

const fixture = { version: 48, name: "Report columns", nodes: [
  { id: "s", type: "device", position: { x: 64, y: 64 }, data: { label: "Source", supplier: "Supplier A", deviceType: "generic", ports: [{ id: "out", label: "Out", direction: "output", signalType: "dmx" }] } },
  { id: "t", type: "device", position: { x: 400, y: 64 }, data: { label: "Target", deviceType: "generic", ports: [{ id: "in", label: "In", direction: "input", signalType: "dmx" }] } },
], edges: [{ id: "e", source: "s", target: "t", sourceHandle: "out", targetHandle: "in", data: { signalType: "dmx", cableId: "D001", cableLength: "10m" } }] };
const clean = (text: string) => text.replace(/[▴▾▲▼↑↓]/g, "").trim();

test("report columns reorder React cells, persist across reload, and mirror PDF preview", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "columns.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "cableSchedule" })));
  await expect(page.getByRole("button", { name: "By Supplier", exact: true })).toHaveCount(0);
  const table = page.locator('[data-report-table="cableSchedule"]');
  const headers = async () => (await table.getByRole("columnheader").allTextContents()).map(clean);
  expect((await headers()).slice(0, 5)).toEqual(["Label", "Cable ID", "Signal", "Cable Type", "Length"]);
  const menu = page.getByTestId("column-order-cableSchedule");
  await menu.locator("summary").click();
  await menu.getByText("Signal", { exact: true }).locator("..").dragTo(menu.getByText("Cable ID", { exact: true }).locator(".."));
  await expect.poll(async () => (await headers()).slice(0, 3)).toEqual(["Label", "Signal", "Cable ID"]);
  await menu.getByRole("button", { name: "Reset column order", exact: true }).click();
  await expect.poll(async () => (await headers()).slice(0, 5)).toEqual(["Label", "Cable ID", "Signal", "Cable Type", "Length"]);
  await menu.getByRole("button", { name: "Move Length left", exact: true }).click();
  await menu.getByRole("button", { name: "Move Length left", exact: true }).click();
  await expect.poll(async () => (await headers()).slice(0, 5)).toEqual(["Label", "Cable ID", "Length", "Signal", "Cable Type"]);
  await menu.locator("summary").click();
  const row = table.locator("tbody tr").first();
  await expect(row.locator("td").nth(2)).toHaveText("10m");
  // Keyboard editing verifies the selection model still targets the moved column.
  await row.locator("td").nth(2).click();
  await page.keyboard.press("Enter");
  await row.locator("td").nth(2).locator("input").fill("15m");
  await row.locator("td").nth(2).locator("input").press("Enter");
  await expect(row.locator("td").nth(2)).toHaveText("15m");
  await expect(row.locator("td").nth(3)).toHaveText("DMX");
  await page.getByRole("button", { name: "Columns ▾", exact: true }).click();
  for (const id of ["Label", "Cable ID", "Signal", "Cable Type", "Length", "Source", "Src Port", "Src Conn", "Target", "Tgt Port", "Tgt Conn", "Supplier", "Est. Length", "Gauge", "Alias", "Tested", "Use", "Src Room", "Tgt Room", "Snake"]) {
    await page.getByRole("checkbox", { name: id, exact: true }).uncheck();
  }
  await expect(table.locator("thead th")).toHaveCount(0);
  await expect(row.locator("td")).toHaveCount(0);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page.locator("div.fixed.inset-0.z-40").click({ position: { x: 10, y: 10 } });
  await expect.poll(async () => (await headers()).slice(0, 5)).toEqual(["Label", "Cable ID", "Length", "Signal", "Cable Type"]);
  await expect(row.locator("td").nth(2)).toHaveText("15m");
  await page.getByRole("button", { name: "Devices", exact: true }).last().click();
  const devices = page.locator('[data-report-table="deviceReport"]');
  expect(clean((await devices.getByRole("columnheader").allTextContents()).at(-1)!)).toBe("Supplier");
  const deviceMenu = page.getByTestId("column-order-deviceReport");
  await deviceMenu.locator("summary").click();
  await deviceMenu.getByRole("button", { name: "Move Supplier left", exact: true }).click();
  await deviceMenu.locator("summary").click();
  const sourceRow = devices.locator("tbody tr").filter({ hasText: "Source" });
  await expect(sourceRow.locator("td").nth(-2).locator("input")).toHaveValue("Supplier A");
  await sourceRow.locator("td").nth(-2).locator("input").fill("Supplier B");
  await expect(sourceRow.locator("td").nth(-2).locator("input")).toHaveValue("Supplier B");
  await page.reload();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "cableSchedule" })));
  await expect.poll(async () => (await headers()).slice(0, 5)).toEqual(["Label", "Cable ID", "Length", "Signal", "Cable Type"]);
  await expect(table.locator("tbody tr").first().locator("td").nth(2)).toHaveText("15m");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Print Preview" })).toBeVisible();
  const preview = page.getByRole("heading", { name: "Print Preview" }).locator("..").locator("..");
  const printColumns = async () => (await preview.locator('label:has(input[type="checkbox"])').allTextContents()).map(clean);
  const labels = await printColumns();
  const start = labels.indexOf("Cable ID");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(labels.slice(start, start + 4)).toEqual(["Cable ID", "Length", "Signal", "Cable Type"]);
  await preview.getByRole("button", { name: "Move Length left", exact: true }).click();
  await expect.poll(async () => (await printColumns()).filter(label => ["Length", "Cable ID", "Signal", "Cable Type"].includes(label))).toEqual(["Length", "Cable ID", "Signal", "Cable Type"]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("easyschematic-autosave")!).reportLayouts["column-order:cableSchedule"]);
  expect(saved.slice(0, 3)).toEqual(["label", "length", "cableid"]);
  const download = page.waitForEvent("download");
  await preview.getByRole("button", { name: "Export PDF", exact: true }).click();
  await (await download).saveAs(test.info().outputPath("ordered-cable-schedule.pdf"));
  expect(errors).toEqual([]);
});

test("column controls work across network, lighting, patch, pack and power tables", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  const nodes = [
    { ...fixture.nodes[0], data: { ...fixture.nodes[0].data, powerDrawW: 50, powerCapacityW: 1000, poeBudgetW: 60, dhcpServer: { enabled: true, rangeStart: "10.0.0.10", rangeEnd: "10.0.0.20" }, ports: [
      { ...fixture.nodes[0].data.ports[0], lightingConfig: { universe: 1, startAddress: 1, footprint: 3 } },
      { id: "lan", label: "LAN", direction: "bidirectional", signalType: "ethernet", networkConfig: { ip: "10.0.0.1" } },
    ] } },
    fixture.nodes[1],
    { id: "panel", type: "device", position: { x: 200, y: 300 }, data: { label: "Panel", deviceType: "patch-panel", offCanvas: true, ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } },
  ];
  const edges = [{ ...fixture.edges[0], data: { ...fixture.edges[0].data, patchHops: [{ panelNodeId: "panel", portId: "p", entryFace: "front" }] } }];
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "all-reports.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...fixture, nodes, edges })) });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "network" })));
  const check = async (id: string) => {
    const table = page.locator(`[data-report-table="${id}"]`);
    await expect(table).toBeVisible();
    const before = (await table.locator("thead th").allTextContents()).map(clean);
    const data = table.locator("tbody tr").first();
    const values = await data.locator("td").allTextContents();
    const menu = page.getByTestId(`column-order-${id}`);
    await menu.locator("summary").click();
    await menu.getByRole("button", { name: `Move ${before[0]} right`, exact: true }).click();
    await expect.poll(async () => (await table.locator("thead th").allTextContents()).map(clean).slice(0, 2)).toEqual([before[1], before[0]]);
    const after = await data.locator("td").allTextContents();
    if (values.length === before.length) expect(after.slice(0, 2)).toEqual([values[1], values[0]]);
    await menu.getByRole("button", { name: "Reset column order", exact: true }).click();
    await expect.poll(async () => (await table.locator("thead th").allTextContents()).map(clean)).toEqual(before);
    await menu.locator("summary").click();
  };
  await check("network");
  await check("dhcpServers");
  await check("poeBudget");
  await page.getByRole("button", { name: "Virtual Channels / Lighting", exact: true }).click();
  await check("lighting");
  await page.getByRole("button", { name: "Patch Panels", exact: true }).click();
  await check("patchPanelSchedule");
  await page.getByRole("button", { name: "Pack List", exact: true }).click();
  await check("devices");
  await page.getByRole("button", { name: /^Cables/, exact: false }).last().click();
  await check("cables");
  await page.getByRole("button", { name: "Power", exact: true }).click();
  await check("powerDistros");
  await check("powerDevices");
  expect(errors).toEqual([]);
});
