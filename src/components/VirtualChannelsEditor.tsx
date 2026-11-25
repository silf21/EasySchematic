import type { VirtualChannel, Port, SignalType } from "../types";
import { virtualChannelErrors, virtualChannelLabel, virtualChannelProtocol, hasVirtualLightingConfig, hasVirtualPixelConfig } from "../virtualChannels";
import { allSignals, signalLabel } from "../typeRegistry";
import { useTypeRegistryVersion } from "../hooks/useTypeRegistryVersion";

export default function VirtualChannelsEditor({ channels, ports, onChange }: { channels: VirtualChannel[]; ports: Pick<Port, "id" | "label" | "section">[]; onChange: (channels: VirtualChannel[]) => void }) {
  useTypeRegistryVersion();
  const protocols = [...new Set([...allSignals(), ...channels.flatMap(c => [virtualChannelProtocol(c), c.outputSignal].filter((s): s is SignalType => !!s))])].sort((a, b) => signalLabel(a).localeCompare(signalLabel(b)));
  const patch = (id: string, update: Partial<VirtualChannel>) => onChange(channels.map(c => c.id === id ? { ...c, ...update } : c));
  const inputClass = "w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs";
  return <section className="space-y-2" data-testid="virtual-channels">
    <div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Virtual Channels</h3><button type="button" className="text-xs text-blue-500 cursor-pointer" onClick={() => onChange([...channels, { id: crypto.randomUUID(), label: `Channel ${channels.length + 1}`, portIds: [], protocol: "custom", config: {} }])}>+ Add Virtual Channel</button></div>
    <p className="text-[10px] text-[var(--color-text-muted)]">Apply one protocol configuration to selected ports. Ports may belong to multiple virtual channels. Sections only control visual grouping; IP settings stay on network ports.</p>
    {channels.map(channel => {
      const setConfig = (update: Partial<VirtualChannel["config"]>) => patch(channel.id, { config: { ...channel.config, ...update } });
      const number = (value: string) => value === "" ? undefined : Number(value);
      const protocol = virtualChannelProtocol(channel);
      const lighting = hasVirtualLightingConfig(channel);
      const pixels = hasVirtualPixelConfig(channel);
      return <fieldset key={channel.id} data-testid="virtual-channel" className="border border-[var(--color-border)] rounded p-2 space-y-2">
        <div className="flex gap-2"><input aria-label="Virtual channel name" className={inputClass} value={channel.label} onChange={e => patch(channel.id, { label: e.target.value })} /><button type="button" aria-label={`Remove ${channel.label}`} className="text-xs text-red-400 cursor-pointer" onClick={() => onChange(channels.filter(c => c.id !== channel.id))}>Remove</button></div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">{ports.map(port => <label key={port.id} className="text-[10px] flex gap-1 items-center"><input type="checkbox" checked={channel.portIds.includes(port.id)} onChange={e => patch(channel.id, { portIds: e.target.checked ? [...channel.portIds, port.id] : channel.portIds.filter(id => id !== port.id) })} />{port.label || "Unnamed port"}{port.section ? ` (${port.section})` : ""}</label>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px]">Protocol<select aria-label="Virtual channel protocol" className={inputClass} value={protocol} onChange={e => patch(channel.id, { protocol: e.target.value })}>{protocols.map(id => <option key={id} value={id}>{signalLabel(id)}</option>)}</select></label>
          <label className="text-[10px]">Output signal (optional)<select aria-label="Virtual channel output signal" className={inputClass} value={channel.outputSignal ?? ""} onChange={e => patch(channel.id, { outputSignal: e.target.value || undefined })}><option value="">No separate output signal</option>{protocols.map(id => <option key={id} value={id}>{signalLabel(id)}</option>)}</select></label>
          {lighting && <>
            <label className="text-[10px]">Start universe ({protocol === "artnet" ? "from 0" : "from 1"})<input aria-label="Channel start universe" className={inputClass} type="number" min={protocol === "artnet" ? 0 : 1} value={channel.config.universe ?? ""} onChange={e => setConfig({ universe: number(e.target.value) })} /></label>
            <label className="text-[10px]">DMX start address<input aria-label="Channel DMX start address" className={inputClass} type="number" min={1} max={512} value={channel.config.startAddress ?? ""} onChange={e => setConfig({ startAddress: number(e.target.value) })} /></label>
            <label className="text-[10px]">Manual channel footprint<input aria-label="Channel manual footprint" className={inputClass} type="number" min={1} disabled={pixels && channel.pixelCount !== undefined} value={channel.config.footprint ?? ""} onChange={e => setConfig({ footprint: number(e.target.value) })} /></label>
          </>}
          {(lighting || pixels) && <label className="text-[10px]">{pixels ? "Mode / pixel type" : "Mode"}<input aria-label="Channel mode" className={inputClass} value={channel.config.mode ?? ""} onChange={e => setConfig({ mode: e.target.value || undefined })} /></label>}
          {pixels && <>
            <label className="text-[10px]">Pixel count (optional)<input aria-label="Channel pixel count" className={inputClass} type="number" min={1} value={channel.pixelCount ?? ""} onChange={e => patch(channel.id, { pixelCount: number(e.target.value) })} /></label>
            <label className="text-[10px]">Channels per pixel<input aria-label="Channels per pixel" className={inputClass} type="number" min={1} max={512} value={channel.channelsPerPixel ?? 3} onChange={e => patch(channel.id, { channelsPerPixel: number(e.target.value) })} /></label>
            {lighting && <label className="text-[10px]">Across universes<select aria-label="Universe packing" className={inputClass} value={channel.universePacking ?? "continuous"} onChange={e => patch(channel.id, { universePacking: e.target.value as VirtualChannel["universePacking"] })}><option value="continuous">Continuous, 512 channels</option><option value="whole-pixels">Whole pixels per universe</option></select></label>}
          </>}
        </div>
        <div className="space-y-1">
          <button type="button" className="text-[10px] text-blue-500 cursor-pointer" onClick={() => patch(channel.id, { parameters: [...(channel.parameters ?? []), { id: crypto.randomUUID(), label: "", value: "" }] })}>+ Add protocol parameter</button>
          {(channel.parameters ?? []).map(parameter => <div className="flex gap-1" key={parameter.id}>
            <input aria-label="Protocol parameter name" className={inputClass} placeholder="Parameter" value={parameter.label} onChange={e => patch(channel.id, { parameters: channel.parameters!.map(p => p.id === parameter.id ? { ...p, label: e.target.value } : p) })} />
            <input aria-label="Protocol parameter value" className={inputClass} placeholder="Value" value={parameter.value} onChange={e => patch(channel.id, { parameters: channel.parameters!.map(p => p.id === parameter.id ? { ...p, value: e.target.value } : p) })} />
            <button type="button" aria-label="Remove protocol parameter" className="text-red-400 cursor-pointer" onClick={() => patch(channel.id, { parameters: channel.parameters!.filter(p => p.id !== parameter.id) })}>×</button>
          </div>)}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)]">{virtualChannelLabel(channel)}</p>
        {virtualChannelErrors(channel, ports).map(error => <p key={error} role="alert" className="text-[10px] text-red-400">{error}</p>)}
      </fieldset>;
    })}
  </section>;
}
