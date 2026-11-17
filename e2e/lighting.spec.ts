import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = {
  version: 47, name: "Lighting addressing", nodes: [
    { id: "gateway", type: "device", position: { x: 0, y: 0 }, data: { label: "Art-Net Gateway", deviceType: "generic", ports: [
      { id: "lan", label: "LAN", direction: "bidirectional", signalType: "artnet", connectorType: "rj45" },
      { id: "dmx-out", label: "DMX Out", direction: "output", signalType: "dmx", connectorType: "xlr-5" },
    ] } },
    { id: "light", type: "device", position: { x: 450, y: 0 }, data: { label: "Fixture", deviceType: "generic", ports: [{ id: "dmx-in", label: "DMX In", direction: "input", signalType: "dmx", connectorType: "xlr-5" }] } },
  ], edges: [{ id: "dmx", type: "smoothstep", source: "gateway", sourceHandle: "dmx-out", target: "light", targetHandle: "dmx-in", data: { signalType: "dmx" } }],
};

test("lighting addresses and Art-Net IP settings persist and appear in lighting and network reports", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("easyschematic-skip-landing", "1"));
  await page.goto("/");
  await expect(page.locator(".react-flow")).toBeVisible({ timeout: 30000 });
  await page.locator('input[type=file][accept=".json"]').first().setInputFiles({ name: "lighting.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('.react-flow__node[data-id="gateway"]').dblclick();
  await expect(page.getByText("Addressable (has IP)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "▸ Network", exact: true }).click();
  await page.getByPlaceholder("IP Address", { exact: true }).pressSequentially("2.0.0.10");
  const output = page.getByTestId("lighting-config").first();
  await output.getByRole("button", { name: /DMX \/ Universe/ }).click();
  await output.getByLabel("Universe source", { exact: true }).selectOption("artnet");
  await output.getByLabel("Lighting universe", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.locator('.react-flow__node[data-id="light"]').dblclick();
  const input = page.getByTestId("lighting-config");
  await input.getByRole("button", { name: /DMX \/ Universe/ }).click();
  await input.getByLabel("Universe source", { exact: true }).selectOption("artnet");
  await input.getByLabel("Lighting universe", { exact: true }).fill("0");
  await input.getByLabel("DMX start address", { exact: true }).fill("500");
  await input.getByLabel("DMX channel footprint", { exact: true }).fill("16");
  await expect(input.getByRole("alert")).toContainText("beyond DMX channel 512");
  await input.getByLabel("DMX start address", { exact: true }).fill("101");
  await expect(input.getByRole("alert")).toHaveCount(0);
  await input.getByLabel("Fixture mode", { exact: true }).fill("Standard 16ch");
  await input.screenshot({ path: test.info().outputPath("dmx-address-editor.png") });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.reload();
  await expect(page.locator('.react-flow__node[data-id="light"]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("easyschematic:open-reports", { detail: "lighting" })));
  await expect(page.getByRole("button", { name: "Virtual Channels / Lighting", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Standard 16ch", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "116", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2.0.0.10", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const file = await download;
  await file.saveAs(test.info().outputPath("lighting.csv"));
  const csv = readFileSync(test.info().outputPath("lighting.csv"), "utf8");
  expect(csv).toContain("Standard 16ch");
  expect(csv).toContain("Art-Net,0,101,116,16");
  await page.screenshot({ path: test.info().outputPath("lighting-report.png") });
  await page.getByRole("button", { name: "Network", exact: true }).click();
  await expect(page.getByRole("cell", { name: "2.0.0.10", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
