import { it, expect, afterEach } from "vitest";
import { virtualChannelRange, virtualChannelErrors, cloneVirtualChannelsForPorts, validateVirtualChannels } from "../virtualChannels";
import { computeLightingReport, buildLightingReportCsv, getLightingReportTableData } from "../lightingReport";
import { buildDeviceTemplate, buildTemplatePreset, type TemplateFormValues } from "../deviceTemplateBuild";
import { syncDeviceWithTemplate } from "../templateSync";
import { useSchematicStore as store } from "../store";
import type { VirtualChannel, Port, DeviceTemplate, DeviceData, SchematicNode } from "../types";

const ports: Port[] = ["B1", "A1/D1", "C1", "B2", "A2/D2", "C2", "GND"].map((label, i) => ({ id: `p${i}`, label, direction: "output", signalType: "spi", connectorType: "terminal-block" }));
const channels: VirtualChannel[] = [
  { id: "ch1", protocol: "artnet", outputSignal: "spi", label: "Channel 1", portIds: ["p0", "p1", "p2", "p6"], config: { protocol: "artnet", universe: 0, startAddress: 1 }, pixelCount: 171, channelsPerPixel: 3, universePacking: "whole-pixels" },
  { id: "ch2", protocol: "artnet", label: "Channel 2", portIds: ["p3", "p4", "p5", "p6"], config: { protocol: "artnet", universe: 2, startAddress: 101, footprint: 48 } },
];
const template: DeviceTemplate = { id: "pixel", label: "Pixel Controller", deviceType: "generic", ports, virtualChannels: channels };
const data: DeviceData = { label: "Controller", deviceType: "generic", ports, virtualChannels: channels };
const initial = store.getState();
afterEach(() => store.setState(initial));

it("allows a shared ground while calculating independent multi-universe output ranges", () => {
  expect(virtualChannelErrors(channels[0], ports)).toEqual([]);
  expect(virtualChannelErrors(channels[1], ports)).toEqual([]);
  expect(virtualChannelRange(channels[0])).toEqual({ footprint: 513, endUniverse: 1, endAddress: 3 });
  expect(virtualChannelRange({ ...channels[0], universePacking: "continuous" })).toEqual({ footprint: 513, endUniverse: 1, endAddress: 1 });
  expect(virtualChannelRange(channels[1])).toEqual({ footprint: 48, endUniverse: 2, endAddress: 148 });
});
it("validates address limits, pixel count, missing ports and protocol overflow", () => {
  expect(virtualChannelErrors({ ...channels[0], config: { protocol: "artnet", universe: 32767, startAddress: 1 } }, ports).join()).toContain("last universe");
  expect(virtualChannelErrors({ ...channels[0], pixelCount: 0 }, ports).join()).toContain("Pixel count");
  expect(virtualChannelErrors({ ...channels[0], protocol: "sacn", config: { protocol: "sacn", universe: 0, startAddress: 513 } }, ports).length).toBeGreaterThan(0);
  expect(virtualChannelErrors({ ...channels[0], portIds: ["deleted"] }, ports).join()).toContain("no longer exists");
  expect(virtualChannelErrors({ ...channels[0], config: { universe: 1, startAddress: 512 } }, ports).join()).toContain("does not fit");
  expect(validateVirtualChannels([{ id: "x", portIds: 3 }], ports).length).toBeGreaterThan(0);
});
it("reports each logical channel once with its terminals and exports the range", () => {
  const node: SchematicNode = { id: "node", type: "device", position: { x: 0, y: 0 }, data };
  const rows = computeLightingReport([node]);
  expect(rows).toHaveLength(2);
  expect(rows[0].port).toBe("Channel 1 [B1, A1/D1, C1, GND]");
  expect(rows[0].endAddress).toBe("U1:3");
  expect(buildLightingReportCsv(rows)).toContain("U1:3,513");
  expect(getLightingReportTableData(rows)[0].rows).toHaveLength(2);
});
it("remaps cloned terminal IDs without linking configuration objects between instances", () => {
  const newPorts = ports.map(p => ({ ...p, id: `copy-${p.id}` }));
  const copy = cloneVirtualChannelsForPorts(channels, ports, newPorts)!;
  expect(copy[0].portIds).toEqual(["copy-p0", "copy-p1", "copy-p2", "copy-p6"]);
  copy[0].config.universe = 7;
  expect(channels[0].config.universe).toBe(0);
});
it("keeps mappings when saving a template and a project preset", () => {
  const form = { ports, virtualChannels: channels, label: "Pixel", shortName: "", deviceType: "generic", color: undefined, headerColor: { edited: false }, category: "", manufacturer: "", modelNumber: "", referenceUrl: "", hostname: "", isVenueProvided: false, auxiliaryData: [], searchTermsRaw: "" } as unknown as TemplateFormValues;
  const saved = buildDeviceTemplate(form, { id: "saved" });
  expect(saved.virtualChannels?.[0].portIds).toEqual(["tpl-0", "tpl-1", "tpl-2", "tpl-6"]);
  const preset = buildTemplatePreset({ ports, virtualChannels: channels, hiddenPorts: [], color: undefined, headerColor: { edited: false } });
  expect(preset.virtualChannels?.[1].portIds).toEqual(["preset-3", "preset-4", "preset-5", "preset-6"]);
});
it("places templates with remapped groups and preserves instance addressing during sync", () => {
  store.setState({ nodes: [], edges: [], templatePresets: {} });
  store.getState().addDevice(template, { x: 0, y: 0 });
  const node = store.getState().nodes.find(n => n.type === "device")!;
  const placed = node.data as DeviceData;
  expect(placed.virtualChannels?.[0].portIds).toEqual([0, 1, 2, 6].map(i => placed.ports[i].id));
  placed.virtualChannels![0].config.universe = 7;
  const synced = syncDeviceWithTemplate(placed, { ...template, version: 2 }, node.id, []).updatedData;
  expect(synced.virtualChannels?.[0].config.universe).toBe(7);
  expect(synced.virtualChannels?.[0].portIds).toEqual(placed.virtualChannels![0].portIds);
  expect(template.virtualChannels?.[0].config.universe).toBe(0);
});

it("remaps groups when copying a device and honors explicit removal from templates", () => {
  store.setState({ nodes: [], edges: [], templatePresets: {} });
  store.getState().addDevice(template, { x: 0, y: 0 });
  store.setState({ nodes: store.getState().nodes.map(n => ({ ...n, selected: true })) });
  store.getState().copySelected();
  store.getState().pasteClipboard();
  const devices = store.getState().nodes.filter(n => n.type === "device");
  expect(devices).toHaveLength(2);
  const copied = devices[1].data as DeviceData;
  expect(copied.virtualChannels![0].portIds.every(id => copied.ports.some(p => p.id === id))).toBe(true);
  expect(copied.virtualChannels![0].portIds).not.toEqual((devices[0].data as DeviceData).virtualChannels![0].portIds);
  const synced = syncDeviceWithTemplate(copied, { ...template, virtualChannels: [] }, devices[1].id, []).updatedData;
  expect(synced.virtualChannels).toEqual([]);
});


it("keeps non-lighting protocols generic and does not apply inactive DMX/pixel parameters", () => {
  const channel: VirtualChannel = { ...channels[0], protocol: "ethernet", outputSignal: undefined, parameters: [{ id: "vlan", label: "VLAN", value: "20" }] };
  expect(virtualChannelRange(channel)).toEqual({ footprint: undefined, endUniverse: undefined, endAddress: undefined });
  expect(virtualChannelErrors(channel, ports)).toEqual([]);
  const node: SchematicNode = { id: "n", type: "device", position: { x: 0, y: 0 }, data: { ...data, virtualChannels: [channel] } };
  const [row] = computeLightingReport([node]);
  expect(row.protocol).toBe("Ethernet");
  expect(row.universe).toBe("");
  expect(row.mode).toBe("VLAN: 20");
});

it("treats the selected virtual protocol as authoritative over legacy source metadata", () => {
  const channel: VirtualChannel = { ...channels[0], protocol: "dmx", config: { protocol: "artnet", universe: 0, startAddress: 1 } };
  expect(virtualChannelErrors(channel, ports).join()).toContain("1–63999");
});

it("upgrades legacy lighting channels in schematics and JSON templates", async () => {
  const { migrateSchematic } = await import("../migrations");
  const { parseJsonImport } = await import("../import/parseJson");
  const legacy = { id: "old", label: "Channel 1", portIds: ["p0", "p6"], config: { protocol: "artnet", universe: 0, startAddress: 1 }, pixelCount: 171, channelsPerPixel: 3 };
  const file = migrateSchematic({ version: 47, nodes: [{ id: "n", type: "device", position: { x: 0, y: 0 }, data: { ...data, virtualChannels: undefined, lightingChannels: [legacy] } }], edges: [] });
  const upgraded = file.nodes[0].data as DeviceData;
  expect(upgraded.virtualChannels?.[0]).toMatchObject({ protocol: "artnet", outputSignal: "spi", config: legacy.config, portIds: legacy.portIds, pixelCount: 171 });
  expect(upgraded).not.toHaveProperty("lightingChannels");
  const imported = parseJsonImport(JSON.stringify({ label: "Controller", deviceType: "adapter", manufacturer: "Generic", ports, lightingChannels: [legacy] }));
  expect(imported.templates[0].validation.ok).toBe(true);
  expect(imported.templates[0].template.virtualChannels?.[0]).toMatchObject({ protocol: "artnet", outputSignal: "spi", portIds: legacy.portIds });
});
