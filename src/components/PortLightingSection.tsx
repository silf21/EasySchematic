import { useState } from "react";
import type { LightingProtocol, PortLightingConfig, SignalType } from "../types";
import { hasLightingConfig, lightingProtocol, lightingConfigErrors, lightingEndAddress, LIGHTING_UNIVERSE_LIMITS } from "../lightingConfig";

export default function PortLightingSection({ signalType, config, onChange }: {
  signalType: SignalType;
  config?: PortLightingConfig;
  onChange: (config: PortLightingConfig | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = config ?? {};
  const protocol = lightingProtocol(signalType, c);
  const limits = LIGHTING_UNIVERSE_LIMITS[protocol];
  const errors = lightingConfigErrors(c, protocol);
  const end = lightingEndAddress(c);
  const update = (patch: Partial<PortLightingConfig>) => {
    const next = { ...c, ...patch };
    for (const key of Object.keys(next) as (keyof PortLightingConfig)[]) if (next[key] === undefined || next[key] === "") delete next[key];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const fieldClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-1 text-[10px] outline-none focus:border-blue-500";
  return <div className="pl-6 mb-1" data-testid="lighting-config">
    <button type="button" onClick={() => setOpen(!open)} className={`text-[10px] cursor-pointer ${errors.length ? "text-amber-600" : hasLightingConfig(c) ? "text-blue-600" : "text-[var(--color-text-muted)]"}`}>
      {open ? "▾" : "▸"} DMX / Universe{hasLightingConfig(c) ? " (configured)" : ""}
    </button>
    {open && <div className="mt-1 space-y-1">
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <label>Universe source<select className={fieldClass} aria-label="Universe source" value={protocol} disabled={signalType === "artnet" || signalType === "sacn"} onChange={e => update({ protocol: e.target.value as LightingProtocol })}>
          <option value="dmx">Local DMX</option><option value="artnet">Art-Net</option><option value="sacn">sACN</option>
        </select></label>
        <label>Universe<input className={fieldClass} aria-label="Lighting universe" type="number" step="1" min={limits.min} max={limits.max} placeholder={`${limits.min}–${limits.max}`} value={c.universe ?? ""} onChange={e => update({ universe: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
        <label>DMX start address<input className={fieldClass} aria-label="DMX start address" type="number" step="1" min={1} max={512} placeholder="1–512" value={c.startAddress ?? ""} onChange={e => update({ startAddress: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
        <label>Channel footprint<input className={fieldClass} aria-label="DMX channel footprint" type="number" step="1" min={1} max={512} placeholder="1–512" value={c.footprint ?? ""} onChange={e => update({ footprint: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
        <label className="col-span-2">Fixture mode<input className={fieldClass} aria-label="Fixture mode" placeholder="e.g. Standard 16ch" value={c.mode ?? ""} onChange={e => update({ mode: e.target.value })} /></label>
      </div>
      <p className="text-[9px] text-[var(--color-text-muted)]">{protocol === "artnet" ? "Art-Net universes are 0-based (0–32767); no automatic offset." : protocol === "sacn" ? "sACN universes are 1-based (1–63999)." : "Local DMX universe is a logical assignment (1–63999)."}{end !== undefined ? ` End address: ${end}.` : ""}</p>
      {errors.map(error => <p role="alert" className="text-[10px] text-amber-600" key={error}>{error}</p>)}
      {Object.keys(c).length > 0 && <button type="button" className="text-[10px] text-blue-600" onClick={() => onChange(undefined)}>Clear lighting configuration</button>}
    </div>}
  </div>;
}
