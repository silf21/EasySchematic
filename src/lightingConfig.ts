import type { LightingProtocol, Port, PortLightingConfig, SignalType } from "./types";

export const LIGHTING_SIGNAL_TYPES = new Set<SignalType>(["dmx", "artnet", "sacn", "spi"]);
export const LIGHTING_PROTOCOL_LABELS: Record<LightingProtocol, string> = { dmx: "DMX", artnet: "Art-Net", sacn: "sACN" };
export const LIGHTING_UNIVERSE_LIMITS: Record<LightingProtocol, { min: number; max: number }> = {
  dmx: { min: 1, max: 63999 }, artnet: { min: 0, max: 32767 }, sacn: { min: 1, max: 63999 },
};

export function lightingProtocol(signal: SignalType, config?: PortLightingConfig): LightingProtocol {
  if (signal === "artnet") return "artnet";
  if (signal === "sacn") return "sacn";
  return config?.protocol === "artnet" || config?.protocol === "sacn" ? config.protocol : "dmx";
}

export function hasLightingConfig(config?: PortLightingConfig): boolean {
  return !!config && typeof config === "object" && !Array.isArray(config) && (config.universe !== undefined || config.startAddress !== undefined || config.footprint !== undefined || (typeof config.mode === "string" && !!config.mode.trim()));
}

export function lightingEndAddress(config?: PortLightingConfig): number | undefined {
  return typeof config?.startAddress === "number" && typeof config.footprint === "number" ? config.startAddress + config.footprint - 1 : undefined;
}

export function lightingConfigErrors(config: PortLightingConfig, protocol: LightingProtocol): string[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return ["Lighting configuration must be an object."];
  const errors: string[] = [];
  if (config.protocol !== undefined && !["dmx", "artnet", "sacn"].includes(config.protocol)) errors.push("Universe source must be DMX, Art-Net or sACN.");
  if (config.mode !== undefined && typeof config.mode !== "string") errors.push("Fixture mode must be text.");
  const check = (value: number | undefined, label: string, min: number, max: number) => {
    if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) errors.push(`${label} must be an integer ${min}–${max}.`);
  };
  const limits = LIGHTING_UNIVERSE_LIMITS[protocol];
  check(config.universe, `${LIGHTING_PROTOCOL_LABELS[protocol]} universe`, limits.min, limits.max);
  check(config.startAddress, "DMX start address", 1, 512);
  check(config.footprint, "Channel footprint", 1, 512);
  const end = lightingEndAddress(config);
  if (end !== undefined && Number.isFinite(end) && end > 512) errors.push(`Channel range ends at ${end}, beyond DMX channel 512.`);
  return errors;
}

export function lightingAddressLabel(port: Pick<Port, "signalType" | "lightingConfig">): string {
  const config = port.lightingConfig;
  if (!hasLightingConfig(config)) return "";
  const protocol = lightingProtocol(port.signalType, config);
  const end = lightingEndAddress(config);
  return [
    config?.universe !== undefined ? `${LIGHTING_PROTOCOL_LABELS[protocol]} U${config.universe}` : LIGHTING_PROTOCOL_LABELS[protocol],
    config?.startAddress !== undefined ? `Addr ${config.startAddress}${end !== undefined ? `–${end}` : ""}` : "",
    config?.footprint !== undefined ? `${config.footprint} ch` : "",
    typeof config?.mode === "string" ? config.mode.trim() : "",
  ].filter(Boolean).join(" · ");
}
