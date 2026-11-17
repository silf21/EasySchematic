import type { VirtualChannel, Port, SignalType, LightingProtocol, PortLightingConfig } from "./types";
import { signalLabel } from "./typeRegistry";
import { lightingConfigErrors, LIGHTING_UNIVERSE_LIMITS } from "./lightingConfig";

export function virtualChannelProtocol(channel: VirtualChannel): SignalType {
  return channel.protocol ?? channel.config?.protocol ?? "dmx";
}
export function hasVirtualLightingConfig(channel: VirtualChannel): boolean {
  return ["dmx", "artnet", "sacn"].includes(virtualChannelProtocol(channel));
}
export function hasVirtualPixelConfig(channel: VirtualChannel): boolean {
  return channel.outputSignal === "spi" || virtualChannelProtocol(channel) === "spi";
}

/** Upgrade saved schematics, presets and user-template archives without losing configuration. */
export function upgradeVirtualChannelsInPlace(value: unknown, seen = new Set<object>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  const owner = value as Record<string, unknown>;
  if (owner.lightingChannels !== undefined || owner.virtualChannels !== undefined) {
    const source = owner.virtualChannels ?? owner.lightingChannels;
    owner.virtualChannels = Array.isArray(source) ? source.map(raw => {
      if (!raw || typeof raw !== "object") return raw;
      const config = raw.config ?? {};
      return { ...raw, protocol: raw.protocol ?? config.protocol ?? "dmx", outputSignal: raw.outputSignal ?? (raw.pixelCount !== undefined || raw.channelsPerPixel !== undefined ? "spi" : undefined) };
    }) : source;
    delete owner.lightingChannels;
  }
  for (const child of Object.values(owner)) upgradeVirtualChannelsInPlace(child, seen);
}

export function remapVirtualChannels(channels: VirtualChannel[] | undefined, idMap: ReadonlyMap<string, string>, validIds?: ReadonlySet<string>): VirtualChannel[] | undefined {
  if (!channels?.length) return undefined;
  return channels.map(c => ({ ...c, config: { ...c.config }, parameters: c.parameters?.map(p => ({ ...p })), portIds: [...new Set(c.portIds.map(id => idMap.get(id) ?? id).filter(id => !validIds || validIds.has(id)))] }));
}
export function cloneVirtualChannelsForPorts(channels: VirtualChannel[] | undefined, before: Pick<Port, "id">[], after: Pick<Port, "id">[]) {
  return remapVirtualChannels(channels, new Map(before.flatMap((p, i) => after[i] ? [[p.id, after[i].id] as const] : [])), new Set(after.map(p => p.id)));
}
export function virtualChannelRange(channel: VirtualChannel) {
  const config: PortLightingConfig = hasVirtualLightingConfig(channel) ? { ...channel.config, protocol: virtualChannelProtocol(channel) as LightingProtocol } : {};
  const cpp = channel.channelsPerPixel ?? 3;
  const footprint = hasVirtualPixelConfig(channel) && channel.pixelCount !== undefined ? channel.pixelCount * cpp : config.footprint;
  const start = config.startAddress;
  const universe = config.universe;
  let endUniverse: number | undefined, endAddress: number | undefined;
  if (Number.isSafeInteger(footprint) && footprint! > 0 && Number.isInteger(start) && start! >= 1 && start! <= 512 && Number.isInteger(universe)) {
    if (channel.universePacking === "whole-pixels" && hasVirtualPixelConfig(channel) && channel.pixelCount !== undefined && Number.isInteger(cpp) && cpp > 0 && cpp <= 512) {
      const first = Math.floor((513 - start!) / cpp) * cpp;
      const capacity = Math.floor(512 / cpp) * cpp;
      if (first >= cpp) {
        const remaining = footprint! - first;
        const extra = remaining > 0 ? Math.ceil(remaining / capacity) : 0;
        endUniverse = universe! + extra;
        endAddress = extra ? ((remaining - 1) % capacity) + 1 : start! + footprint! - 1;
      }
    } else {
      const last = start! - 1 + footprint! - 1;
      endUniverse = universe! + Math.floor(last / 512);
      endAddress = last % 512 + 1;
    }
  }
  return { footprint, endUniverse, endAddress };
}
export function virtualChannelErrors(channel: VirtualChannel, ports: Pick<Port, "id">[]): string[] {
  const protocol = virtualChannelProtocol(channel);
  const config = channel.config ?? {};
  const lighting = hasVirtualLightingConfig(channel);
  const pixels = hasVirtualPixelConfig(channel);
  const errors = lighting ? lightingConfigErrors({ ...config, footprint: undefined }, protocol as LightingProtocol) : [];
  if (!protocol.trim()) errors.push("Select a protocol.");
  if (!channel.label.trim()) errors.push("Channel name is required.");
  if (!channel.portIds.length) errors.push("Select at least one physical port.");
  if (channel.portIds.some(id => !ports.some(p => p.id === id))) errors.push("A mapped port no longer exists.");
  if (channel.parameters?.some(p => !p.label.trim())) errors.push("Parameter names cannot be blank.");
  if (pixels && channel.pixelCount !== undefined && (!Number.isSafeInteger(channel.pixelCount) || channel.pixelCount < 1)) errors.push("Pixel count must be a positive integer.");
  const cpp = channel.channelsPerPixel ?? 3;
  if (pixels && (!Number.isInteger(cpp) || cpp < 1 || cpp > 512)) errors.push("Channels per pixel must be an integer 1–512.");
  if (pixels && channel.universePacking !== undefined && !["continuous", "whole-pixels"].includes(channel.universePacking)) errors.push("Unknown universe packing.");
  const range = virtualChannelRange(channel);
  if (range.footprint !== undefined && (!Number.isSafeInteger(range.footprint) || range.footprint < 1)) errors.push("Channel footprint must be a positive integer.");
  if (lighting && pixels && channel.universePacking === "whole-pixels" && channel.pixelCount !== undefined && config.startAddress !== undefined && config.startAddress > 513 - cpp && !errors.length) errors.push("The first pixel does not fit before channel 512.");
  if (lighting && range.endUniverse !== undefined && range.endUniverse > LIGHTING_UNIVERSE_LIMITS[protocol as LightingProtocol].max) errors.push("Channel range exceeds the protocol's last universe.");
  return errors;
}
export function virtualChannelLabel(channel: VirtualChannel): string {
  const r = virtualChannelRange(channel);
  const lighting = hasVirtualLightingConfig(channel);
  return [channel.label, signalLabel(virtualChannelProtocol(channel)), lighting && channel.config.universe !== undefined ? `U${channel.config.universe}` : "", lighting && channel.config.startAddress !== undefined ? `Addr ${channel.config.startAddress}` : "", r.endAddress !== undefined ? `→ U${r.endUniverse}:${r.endAddress}` : "", r.footprint !== undefined ? `${r.footprint} ch` : "", ...(channel.parameters ?? []).map(p => `${p.label}: ${p.value}`)].filter(Boolean).join(" · ");
}

export function validateVirtualChannels(value: unknown, ports: Pick<Port, "id">[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ["Virtual channels must be an array."];
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id.trim() || typeof raw.label !== "string" || !Array.isArray(raw.portIds) || raw.portIds.some((id: unknown) => typeof id !== "string") || !raw.config || typeof raw.config !== "object" || Array.isArray(raw.config)) {
      errors.push("Each virtual channel needs an id, name, port IDs and a configuration object.");
      continue;
    }
    if (raw.protocol !== undefined && (typeof raw.protocol !== "string" || !raw.protocol.trim())) { errors.push("Virtual channel protocol must be text."); continue; }
    if (raw.outputSignal !== undefined && typeof raw.outputSignal !== "string") { errors.push("Virtual channel output signal must be text."); continue; }
    if (raw.parameters !== undefined && (!Array.isArray(raw.parameters) || raw.parameters.some((p: unknown) => !p || typeof p !== "object" || typeof (p as Record<string, unknown>).id !== "string" || typeof (p as Record<string, unknown>).label !== "string" || typeof (p as Record<string, unknown>).value !== "string"))) { errors.push("Virtual channel parameters must have id, name and value text."); continue; }
    if (ids.has(raw.id)) errors.push(`Duplicate virtual channel id: ${raw.id}`);
    ids.add(raw.id);
    errors.push(...virtualChannelErrors(raw as VirtualChannel, ports).map(error => `${raw.label}: ${error}`));
  }
  return errors;
}
