import { describe, expect, it } from "vitest";
import type { Port, PortLightingConfig, SchematicNode } from "../types";
import { lightingConfigErrors, lightingEndAddress, lightingProtocol, lightingAddressLabel } from "../lightingConfig";
import { buildLightingReportCsv, computeLightingReport, getLightingReportTableData, createLightingReportLayout, LIGHTING_COLUMNS } from "../lightingReport";
import { computeNetworkReport } from "../networkReport";
import { NETWORK_SIGNAL_TYPES } from "../connectorTypes";
import { syncDeviceWithTemplate } from "../templateSync";
import { resolveAuxiliaryLine } from "../auxiliaryData";

const port = (id: string, signalType: string, lightingConfig?: PortLightingConfig): Port => ({ id, label: id, signalType, direction: "input", lightingConfig });
const node = (id: string, ports: Port[]): SchematicNode => ({ id, type: "device", position: { x: 0, y: 0 }, data: { label: id, deviceType: "generic", ports } });

describe("lighting patch validation", () => {
  it("distinguishes Art-Net zero-based and sACN one-based universes without shifting values", () => {
    expect(lightingConfigErrors({ universe: 0 }, "artnet")).toEqual([]);
    expect(lightingConfigErrors({ universe: 32767 }, "artnet")).toEqual([]);
    expect(lightingConfigErrors({ universe: 32768 }, "artnet")).toHaveLength(1);
    expect(lightingConfigErrors({ universe: 0 }, "sacn")).toHaveLength(1);
    expect(lightingConfigErrors({ universe: 63999 }, "sacn")).toEqual([]);
    expect(lightingConfigErrors({ universe: 64000 }, "sacn")).toHaveLength(1);
    expect(lightingConfigErrors({ universe: 0 }, "dmx")).toHaveLength(1);
  });
  it("accepts the last DMX channel and flags footprint overflow, fractional and invalid values", () => {
    expect(lightingConfigErrors({ startAddress: 512, footprint: 1 }, "dmx")).toEqual([]);
    expect(lightingConfigErrors({ startAddress: 500, footprint: 16 }, "dmx")).toContain("Channel range ends at 515, beyond DMX channel 512.");
    expect(lightingConfigErrors({ startAddress: 0, footprint: 0 }, "dmx")).toHaveLength(2);
    expect(lightingConfigErrors({ startAddress: 1.5, footprint: NaN }, "dmx")).toHaveLength(2);
    expect(lightingEndAddress({ startAddress: 101, footprint: 16 })).toBe(116);
    expect(lightingEndAddress({ startAddress: 101 })).toBeUndefined();
  });
  it("keeps explicit source protocol on a DMX output, while network signal type determines its own protocol", () => {
    expect(lightingProtocol("dmx", { protocol: "artnet" })).toBe("artnet");
    expect(lightingProtocol("sacn", { protocol: "artnet" })).toBe("sacn");
    expect(lightingProtocol("artnet")).toBe("artnet");
    expect(lightingConfigErrors({}, "dmx")).toEqual([]);
  });
  it("does not crash on malformed optional data imported in a schematic", () => {
    expect(lightingConfigErrors({ mode: 123 } as unknown as PortLightingConfig, "dmx")).toContain("Fixture mode must be text.");
    expect(lightingConfigErrors([] as PortLightingConfig, "dmx")).toHaveLength(1);
    expect(lightingAddressLabel(port("p", "dmx", { universe: 1, mode: 123 } as unknown as PortLightingConfig))).toContain("DMX U1");
  });
});

describe("lighting reports and schema labels", () => {
  const nodes = [
    node("Gateway", [{ ...port("LAN", "artnet"), networkConfig: { ip: "2.0.0.10", subnetMask: "255.0.0.0" } }, port("DMX Out 1", "dmx", { protocol: "artnet", universe: 0 }), port("DMX Out 2", "dmx", { protocol: "sacn", universe: 1 })]),
    node("Fixture", [port("DMX In", "dmx", { protocol: "artnet", universe: 0, startAddress: 101, footprint: 16, mode: 'Standard, "16ch"' }), port("DMX Thru", "dmx")]),
  ];
  it("enables normal IP and network reporting for Art-Net and sACN without adding IP fields to DMX", () => {
    expect(NETWORK_SIGNAL_TYPES.has("artnet")).toBe(true);
    expect(NETWORK_SIGNAL_TYPES.has("sacn")).toBe(true);
    expect(NETWORK_SIGNAL_TYPES.has("dmx")).toBe(false);
    expect(computeNetworkReport([...nodes, node("sACN receiver", [port("LAN", "sacn")])])).toHaveLength(2);
  });
  it("reports per-output mappings and fixture ranges, including the node's separate network IP", () => {
    const rows = computeLightingReport(nodes);
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.port === "DMX Out 1")).toMatchObject({ protocol: "Art-Net", universe: "0", ip: "2.0.0.10" });
    expect(rows.find(r => r.port === "DMX Out 2")).toMatchObject({ protocol: "sACN", universe: "1" });
    expect(rows.find(r => r.device === "Fixture")).toMatchObject({ universe: "0", startAddress: "101", endAddress: "116", footprint: "16" });
  });
  it("keeps CSV and PDF data aligned and escapes fixture mode text", () => {
    const rows = computeLightingReport(nodes);
    expect(buildLightingReportCsv(rows)).toContain('"Standard, ""16ch"""');
    const table = getLightingReportTableData(rows)[0];
    expect(table.rows).toHaveLength(3);
    expect(Object.keys(table.rows[0])).toEqual(LIGHTING_COLUMNS.map(c => c.key));
    expect(createLightingReportLayout().tables[0].columns.map(c => c.key)).toEqual(Object.keys(table.rows[0]));
  });
  it("provides an opt-in schematic label without creating duplicate material or changing port names", () => {
    const fixture = nodes[1];
    if (fixture.type !== "device") throw new Error("wrong fixture");
    expect(resolveAuxiliaryLine("{{lightingPatch}}", fixture.data)).toContain("Art-Net U0 · Addr 101–116 · 16 ch");
    expect(fixture.data.ports[0].label).toBe("DMX In");
  });
  it("keeps validation warnings visible for out-of-range loaded values", () => {
    const rows = computeLightingReport([node("bad fixture", [port("In", "dmx", { universe: 1, startAddress: 512, footprint: 2 })])]);
    expect(rows[0].warnings).toContain("beyond DMX channel 512");
  });
});

it("preserves per-instance addresses, mode and IP when a device template is synchronized", () => {
  const config = { protocol: "artnet" as const, universe: 0, startAddress: 101, footprint: 16, mode: "Standard" };
  const device = { label: "Fixture 1", deviceType: "generic", ports: [{ ...port("instance", "artnet", config), label: "LAN", templatePortId: "template-port", networkConfig: { ip: "2.0.0.10" } }] };
  const template = { id: "template", version: 2, label: "Fixture", deviceType: "generic", ports: [{ ...port("template-port", "artnet", { universe: 12 }), label: "LAN" }] };
  const result = syncDeviceWithTemplate(device, template, "fixture", []);
  expect(result.updatedData.ports[0].lightingConfig).toEqual(config);
  expect(result.updatedData.ports[0].networkConfig?.ip).toBe("2.0.0.10");
});
