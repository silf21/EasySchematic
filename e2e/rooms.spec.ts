import { test, expect } from "@playwright/test";

for (const reverse of [false, true]) {
  test(`nested rooms remain selectable and editable regardless of order (${reverse})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
    await page.goto("/");
    await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
    const rooms = [
      { id: "outer", type: "room", position: { x: 0, y: 0 }, style: { width: 800, height: 600 }, data: { label: "Outer" }, zIndex: -1 },
      { id: "inner", type: "room", position: { x: 96, y: 96 }, style: { width: 400, height: 320 }, data: { label: "Inner" }, zIndex: -1 },
      { id: "deep", type: "room", position: { x: 144, y: 144 }, style: { width: 240, height: 160 }, data: { label: "Deep" }, zIndex: -1 },
    ];
    const fixture = { version: 47, name: "Nested rooms", nodes: [...(reverse ? rooms.reverse() : rooms), { id: "device", type: "device", position: { x: 208, y: 224 }, data: { label: "Test Device", deviceType: "generic", ports: [] } }], edges: [] };
    await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "rooms.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
    const inner = page.locator('.react-flow__node[data-id="inner"]');
    const deep = page.locator('.react-flow__node[data-id="deep"]');
    await page.locator(".react-flow__controls-fitview").click();
    await inner.getByText("Inner", { exact: true }).click();
    await expect(inner).toHaveClass(/selected/);
    await deep.getByText("Deep", { exact: true }).click();
    await expect(deep).toHaveClass(/selected/);
    await deep.getByText("Deep", { exact: true }).dblclick();
    await deep.locator("input").fill("Subroom renamed");
    await deep.locator("input").press("Enter");
    await expect(deep.getByText("Subroom renamed", { exact: true })).toBeVisible();
    await page.locator('.react-flow__node[data-id="outer"]').getByTitle("Lock room", { exact: true }).click();
    await inner.getByText("Inner", { exact: true }).click();
    await expect(inner).toHaveClass(/selected/);
    await page.locator('.react-flow__node[data-id="device"]').getByText("Test Device", { exact: true }).click();
    await expect(page.locator('.react-flow__node[data-id="device"]')).toHaveClass(/selected/);
    await page.reload();
    await page.locator(".react-flow__controls-fitview").click();
    await deep.getByText("Subroom renamed", { exact: true }).click();
    await expect(deep).toHaveClass(/selected/);
    expect(errors).toEqual([]);
  });
}
