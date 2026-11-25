import { test, expect } from "@playwright/test";

test("generated patch references travel with their room and retain membership after reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible();
  const fixture = { version: 48, name: "Patch rooms", nodes: [
    { id: "room", type: "room", position: { x: 96, y: 96 }, style: { width: 512, height: 400 }, data: { label: "Stage" } },
    { id: "panel", type: "device", position: { x: 0, y: 0 }, data: { label: "Panel", deviceType: "patch-panel", ports: [{ id: "p", label: "DMX1", direction: "passthrough", signalType: "dmx" }] } },
  ], edges: [{ id: "e", source: "panel", target: "panel", sourceHandle: "p", targetHandle: "p", data: { signalType: "dmx", patchHops: [{ panelNodeId: "panel", portId: "p" }] } }] };
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "patch-room.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  const ref = page.locator('.react-flow__node-patch-reference');
  const room = page.locator('.react-flow__node[data-id="room"]');
  await expect(ref).toBeVisible();
  await page.locator(".react-flow__controls-fitview").click();
  const moveRoom = async () => {
    const beforeRef = (await ref.boundingBox())!;
    const beforeRoom = (await room.boundingBox())!;
    const title = (await room.getByText("Stage", { exact: true }).boundingBox())!;
    await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x + title.width / 2 + 100, title.y + title.height / 2 + 70, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await room.boundingBox())!.x - beforeRoom.x).toBeGreaterThan(50);
    const afterRef = (await ref.boundingBox())!;
    const afterRoom = (await room.boundingBox())!;
    expect(Math.abs((afterRef.x - beforeRef.x) - (afterRoom.x - beforeRoom.x))).toBeLessThan(2);
    expect(Math.abs((afterRef.y - beforeRef.y) - (afterRoom.y - beforeRoom.y))).toBeLessThan(2);
  };
  await moveRoom();
  await page.reload();
  await expect(ref).toBeVisible();
  await page.locator(".react-flow__controls-fitview").click();
  await moveRoom();
  expect(errors).toEqual([]);
});
