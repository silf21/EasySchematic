import type { LightingChannel, Port, LightingProtocol } from "../types";
import { lightingChannelErrors, lightingChannelLabel } from "../lightingChannels";

export default function LightingChannelsEditor({ channels, ports, onChange }: { channels: LightingChannel[]; ports: Pick<Port, "id" | "label" | "section">[]; onChange: (channels: LightingChannel[]) => void }) {
  const patch = (id: string, update: Partial<LightingChannel>) => onChange(channels.map(c => c.id === id ? { ...c, ...update } : c));
  const inputClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs";
  return <section className="space-y-2" data-testid="lighting-channels">
    <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Lighting Channels</h3><button type="button" className="text-xs text-blue-500 cursor-pointer" onClick={() => onChange([...channels, { id: crypto.randomUUID(), label: `Channel ${channels.length + 1}`, portIds: [], config: { protocol: "artnet" } }])}>+ Add Lighting Channel</button></div>
    <p className="text-[10px] text-[var(--color-text-muted)]">One mapping per logical output. Select all its terminals; shared GND may belong to multiple channels. Sections only control visual grouping.</p>
    {channels.map(channel => {
      const setConfig = (update: Partial<LightingChannel["config"]>) => patch(channel.id, { config: { ...channel.config, ...update } });
      const number = (value: string) => value === "" ? undefined : Number(value);
      return <fieldset key={channel.id} data-testid="lighting-channel" className="border border-[var(--color-border)] rounded p-2 space-y-2">
        <div className="flex gap-2"><input aria-label="Lighting channel name" className={inputClass} value={channel.label} onChange={e => patch(channel.id, { label: e.target.value })} /><button type="button" aria-label={`Remove ${channel.label}`} className="text-xs text-red-400 cursor-pointer" onClick={() => onChange(channels.filter(c => c.id !== channel.id))}>Remove</button></div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">{ports.map(port => <label key={port.id} className="text-[10px] flex gap-1 items-center"><input type="checkbox" checked={channel.portIds.includes(port.id)} onChange={e => patch(channel.id, { portIds: e.target.checked ? [...channel.portIds, port.id] : channel.portIds.filter(id => id !== port.id) })} />{port.label || "Unnamed port"}{port.section ? ` (${port.section})` : ""}</label>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px]">Universe source<select aria-label="Channel universe source" className={inputClass} value={channel.config.protocol ?? "dmx"} onChange={e => setConfig({ protocol: e.target.value as LightingProtocol })}><option value="artnet">Art-Net (from 0)</option><option value="sacn">sACN (from 1)</option><option value="dmx">Local DMX (from 1)</option></select></label>
          <label className="text-[10px]">Start universe<input aria-label="Channel start universe" className={inputClass} type="number" min={channel.config.protocol === "artnet" ? 0 : 1} value={channel.config.universe ?? ""} onChange={e => setConfig({ universe: number(e.target.value) })} /></label>
          <label className="text-[10px]">DMX start address<input aria-label="Channel DMX start address" className={inputClass} type="number" min={1} max={512} value={channel.config.startAddress ?? ""} onChange={e => setConfig({ startAddress: number(e.target.value) })} /></label>
          <label className="text-[10px]">Mode / pixel type<input aria-label="Channel mode" className={inputClass} value={channel.config.mode ?? ""} placeholder="e.g. RGB / WS2811" onChange={e => setConfig({ mode: e.target.value || undefined })} /></label>
          <label className="text-[10px]">Pixel count (optional)<input aria-label="Channel pixel count" className={inputClass} type="number" min={1} value={channel.pixelCount ?? ""} onChange={e => patch(channel.id, { pixelCount: number(e.target.value) })} /></label>
          <label className="text-[10px]">Channels per pixel<input aria-label="Channels per pixel" className={inputClass} type="number" min={1} max={512} value={channel.channelsPerPixel ?? 3} onChange={e => patch(channel.id, { channelsPerPixel: number(e.target.value) })} /></label>
          <label className="text-[10px]">Manual channel footprint<input aria-label="Channel manual footprint" className={inputClass} type="number" min={1} disabled={channel.pixelCount !== undefined} value={channel.config.footprint ?? ""} onChange={e => setConfig({ footprint: number(e.target.value) })} /></label>
          <label className="text-[10px]">Across universes<select aria-label="Universe packing" className={inputClass} value={channel.universePacking ?? "continuous"} onChange={e => patch(channel.id, { universePacking: e.target.value as LightingChannel["universePacking"] })}><option value="continuous">Continuous, 512 channels</option><option value="whole-pixels">Whole pixels per universe</option></select></label>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)]">{lightingChannelLabel(channel)}</p>
        {lightingChannelErrors(channel, ports).map(error => <p key={error} role="alert" className="text-[10px] text-red-400">{error}</p>)}
      </fieldset>;
    })}
  </section>;
}
