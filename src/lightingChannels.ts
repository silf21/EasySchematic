import type { LightingChannel, Port } from "./types";
import { lightingConfigErrors, lightingProtocol, LIGHTING_UNIVERSE_LIMITS } from "./lightingConfig";

export function remapLightingChannels(channels: LightingChannel[] | undefined, idMap: ReadonlyMap<string, string>, validIds?: ReadonlySet<string>): LightingChannel[] | undefined {
  if (!channels?.length) return undefined;
  return channels.map(c => ({ ...c, config: { ...c.config }, portIds: [...new Set(c.portIds.map(id => idMap.get(id) ?? id).filter(id => !validIds || validIds.has(id)))] }));
}
export function cloneLightingChannelsForPorts(channels: LightingChannel[] | undefined, before: Pick<Port, "id">[], after: Pick<Port, "id">[]) {
  return remapLightingChannels(channels, new Map(before.flatMap((p, i) => after[i] ? [[p.id, after[i].id] as const] : [])), new Set(after.map(p => p.id)));
}
export function lightingChannelRange(channel: LightingChannel) {
  const config = channel.config ?? {};
  const cpp = channel.channelsPerPixel ?? 3;
  const footprint = channel.pixelCount !== undefined ? channel.pixelCount * cpp : config.footprint;
  const start = config.startAddress;
  const universe = config.universe;
  let endUniverse: number | undefined, endAddress: number | undefined;
  if (Number.isSafeInteger(footprint) && footprint! > 0 && Number.isInteger(start) && start! >= 1 && start! <= 512 && Number.isInteger(universe)) {
    if (channel.universePacking === "whole-pixels" && channel.pixelCount !== undefined && Number.isInteger(cpp) && cpp > 0 && cpp <= 512) {
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
export function lightingChannelErrors(channel: LightingChannel, ports: Pick<Port, "id">[]): string[] {
  const config = channel.config ?? {};
  const protocol = lightingProtocol("dmx", config);
  const errors = lightingConfigErrors({ ...config, footprint: undefined }, protocol);
  if (!channel.label.trim()) errors.push("Channel name is required.");
  if (!channel.portIds.length) errors.push("Select at least one physical port.");
  if (channel.portIds.some(id => !ports.some(p => p.id === id))) errors.push("A mapped port no longer exists.");
  if (channel.pixelCount !== undefined && (!Number.isSafeInteger(channel.pixelCount) || channel.pixelCount < 1)) errors.push("Pixel count must be a positive integer.");
  const cpp = channel.channelsPerPixel ?? 3;
  if (!Number.isInteger(cpp) || cpp < 1 || cpp > 512) errors.push("Channels per pixel must be an integer 1–512.");
  if (channel.universePacking !== undefined && !["continuous", "whole-pixels"].includes(channel.universePacking)) errors.push("Unknown universe packing.");
  const range = lightingChannelRange(channel);
  if (range.footprint !== undefined && (!Number.isSafeInteger(range.footprint) || range.footprint < 1)) errors.push("Channel footprint must be a positive integer.");
  if (channel.universePacking === "whole-pixels" && channel.pixelCount !== undefined && config.startAddress !== undefined && config.startAddress > 513 - cpp && !errors.length) errors.push("The first pixel does not fit before channel 512.");
  if (range.endUniverse !== undefined && range.endUniverse > LIGHTING_UNIVERSE_LIMITS[protocol].max) errors.push("Channel range exceeds the protocol's last universe.");
  return errors;
}
export function lightingChannelLabel(channel: LightingChannel): string {
  const r = lightingChannelRange(channel);
  return [channel.label, channel.config.universe !== undefined ? `U${channel.config.universe}` : "", channel.config.startAddress !== undefined ? `Addr ${channel.config.startAddress}` : "", r.endAddress !== undefined ? `→ U${r.endUniverse}:${r.endAddress}` : "", r.footprint !== undefined ? `${r.footprint} ch` : ""].filter(Boolean).join(" · ");
}

export function validateLightingChannels(value: unknown, ports: Pick<Port, "id">[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return ["Lighting channels must be an array."];
  const ids = new Set<string>();
  const errors: string[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id.trim() || typeof raw.label !== "string" || !Array.isArray(raw.portIds) || raw.portIds.some((id: unknown) => typeof id !== "string") || !raw.config || typeof raw.config !== "object" || Array.isArray(raw.config)) {
      errors.push("Each lighting channel needs an id, name, port IDs and a configuration object.");
      continue;
    }
    if (ids.has(raw.id)) errors.push(`Duplicate lighting channel id: ${raw.id}`);
    ids.add(raw.id);
    errors.push(...lightingChannelErrors(raw as LightingChannel, ports).map(error => `${raw.label}: ${error}`));
  }
  return errors;
}
