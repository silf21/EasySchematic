import { signalLabel } from "./typeRegistry";
import { virtualChannelRange, virtualChannelErrors, virtualChannelProtocol, hasVirtualLightingConfig } from "./virtualChannels";
import type { DeviceData, SchematicNode } from "./types";
import { getRoomLabel, csvRow } from "./packList";
import { hasLightingConfig, lightingProtocol, lightingEndAddress, lightingConfigErrors, LIGHTING_SIGNAL_TYPES, LIGHTING_PROTOCOL_LABELS } from "./lightingConfig";
import { createDefaultPackListLayout, type ReportLayout } from "./reportLayout";
import type { ReportTableData } from "./reportPdf";
import { transformLabelNow } from "./labelCaseUtils";

export interface LightingReportRow {
  nodeId: string;
  portId: string;
  device: string;
  port: string;
  room: string;
  protocol: string;
  universe: string;
  startAddress: string;
  endAddress: string;
  footprint: string;
  mode: string;
  ip: string;
  warnings: string;
}

export const LIGHTING_COLUMNS = [
  { key: "device", header: "Device", widthMm: 32 },
  { key: "port", header: "Port", widthMm: 24 },
  { key: "room", header: "Room", widthMm: 22 },
  { key: "protocol", header: "Protocol", widthMm: 18 },
  { key: "universe", header: "Universe", widthMm: 16 },
  { key: "startAddress", header: "Start", widthMm: 12 },
  { key: "endAddress", header: "End", widthMm: 20 },
  { key: "footprint", header: "Channels", widthMm: 16 },
  { key: "mode", header: "Configuration", widthMm: 30 },
  { key: "ip", header: "IP", widthMm: 28 },
  { key: "warnings", header: "Validation", widthMm: 48 },
] as const;

export function computeLightingReport(nodes: SchematicNode[]): LightingReportRow[] {
  const rows: LightingReportRow[] = [];
  for (const node of nodes) {
    if (node.type !== "device") continue;
    const data: DeviceData = node.data;
    const ips = [...new Set(data.ports.map(p => p.networkConfig?.ip?.trim()).filter(Boolean))].join(", ");
    const groupedPorts = new Set(data.virtualChannels?.filter(hasVirtualLightingConfig).flatMap(c => c.portIds) ?? []);
    for (const channel of data.virtualChannels ?? []) {
      const range = virtualChannelRange(channel);
      const protocol = virtualChannelProtocol(channel);
      const lighting = hasVirtualLightingConfig(channel);
      const members = channel.portIds.map(id => data.ports.find(p => p.id === id)?.label ?? id).join(", ");
      rows.push({ nodeId: node.id, portId: `channel:${channel.id}`, device: transformLabelNow(data.label),
        port: transformLabelNow(`${channel.label} [${members}]`), room: getRoomLabel(nodes, node.parentId), protocol: signalLabel(protocol),
        universe: lighting && channel.config.universe !== undefined ? String(channel.config.universe) : "",
        startAddress: lighting && channel.config.startAddress !== undefined ? String(channel.config.startAddress) : "",
        endAddress: range.endAddress !== undefined ? `U${range.endUniverse}:${range.endAddress}` : "",
        footprint: range.footprint !== undefined ? String(range.footprint) : "", mode: [(lighting || channel.outputSignal === "spi" || protocol === "spi") ? channel.config.mode : "", channel.outputSignal ? `Output: ${signalLabel(channel.outputSignal)}` : "", ...(channel.parameters ?? []).map(p => `${p.label}: ${p.value}`)].filter(Boolean).join(" · "), ip: ips,
        warnings: virtualChannelErrors(channel, data.ports).join(" "),
      });
    }
    for (const port of data.ports) {
      if (groupedPorts.has(port.id)) continue;
      const config = port.lightingConfig;
      if (!LIGHTING_SIGNAL_TYPES.has(port.signalType) || !config || (!hasLightingConfig(config) && !config.protocol)) continue;
      const protocol = lightingProtocol(port.signalType, config);
      const end = lightingEndAddress(config);
      rows.push({
        nodeId: node.id, portId: port.id, device: transformLabelNow(data.label), port: transformLabelNow(port.label),
        room: getRoomLabel(nodes, node.parentId), protocol: LIGHTING_PROTOCOL_LABELS[protocol],
        universe: config.universe !== undefined ? String(config.universe) : "",
        startAddress: config.startAddress !== undefined ? String(config.startAddress) : "",
        endAddress: end !== undefined ? String(end) : "",
        footprint: config.footprint !== undefined ? String(config.footprint) : "",
        mode: typeof config.mode === "string" ? config.mode.trim() : "",
        ip: port.networkConfig?.ip?.trim() || ips,
        warnings: lightingConfigErrors(config, protocol).join(" "),
      });
    }
  }
  return rows.sort((a, b) => a.device.localeCompare(b.device) || a.port.localeCompare(b.port, undefined, { numeric: true }));
}

export function buildLightingReportCsv(rows: LightingReportRow[]): string {
  return "\uFEFF" + [csvRow(LIGHTING_COLUMNS.map(c => c.header)), ...rows.map(row => csvRow(LIGHTING_COLUMNS.map(c => row[c.key])))].join("\n");
}

export function getLightingReportTableData(rows: LightingReportRow[]): ReportTableData[] {
  return [{ id: "lighting", rows: rows.map(row => Object.fromEntries(LIGHTING_COLUMNS.map(c => [c.key, row[c.key]]))) }];
}

export function createLightingReportLayout(): ReportLayout {
  const layout = createDefaultPackListLayout();
  layout.headerLayout = { ...layout.headerLayout, cells: layout.headerLayout.cells.map(c => c.content.type === "static" && c.content.text === "Pack List" ? { ...c, content: { type: "static" as const, text: "Virtual Channels / DMX Patch" } } : c) };
  layout.tables = [{ id: "lighting", label: "Virtual Channels / DMX Patch", columns: LIGHTING_COLUMNS.map(c => ({ ...c, visible: true })), groupBy: null, groupByOptions: [], sortBy: null, sortDir: "asc" }];
  layout.orientation = "landscape";
  layout.paperSize = "a4";
  return layout;
}
