import { useEffect, useState } from "react";
import { useSchematicStore } from "../store";
import type { ConnectionData, ConnectorType, PatchSegmentOverride, PhysicalCable, Provision } from "../types";
import { segmentsForEdge } from "../patchCircuits";
import { PROVISION_LABELS, supplierName } from "../suppliers";
import { connectorLabel, connectorsByLabel } from "../typeRegistry";
import { areConnectorsCompatible } from "../connectorTypes";
import SupplierInput from "./SupplierInput";

export function ProvisionSelect({ value, onChange }: { value?: Provision; onChange: (value: Provision) => void }) {
  return <select aria-label="Provision" className="border rounded px-2 py-1 text-xs" value={value ?? "bring"} onChange={e => onChange(e.target.value as Provision)}>
    {Object.entries(PROVISION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
  </select>;
}

function ConnectorSelect({ value, onChange }: { value?: ConnectorType; onChange: (v: ConnectorType | undefined) => void }) {
  return <select aria-label="Cable connector" className="border rounded px-1 py-1 text-xs min-w-0" value={value ?? ""} onChange={e => onChange(e.target.value as ConnectorType || undefined)}>
    <option value="">From endpoint</option>{connectorsByLabel().map(c => <option key={c} value={c}>{connectorLabel(c)}</option>)}
  </select>;
}

export default function PhysicalPathEditorHost() {
  const [edgeId, setEdgeId] = useState<string | null>(null);
  useEffect(() => {
    const open = (e: Event) => setEdgeId((e as CustomEvent<string>).detail);
    window.addEventListener("easyschematic:physical-path", open);
    return () => window.removeEventListener("easyschematic:physical-path", open);
  }, []);
  return edgeId ? <PhysicalPathEditor key={edgeId} edgeId={edgeId} onClose={() => setEdgeId(null)} /> : null;
}

function PhysicalPathEditor({ edgeId, onClose }: { edgeId: string; onClose: () => void }) {
  const nodes = useSchematicStore(s => s.nodes);
  const edges = useSchematicStore(s => s.edges);
  const original = edges.find(e => e.id === edgeId);
  const [draft, setDraft] = useState<ConnectionData>(() => structuredClone(original?.data ?? { signalType: "Custom" }));
  const edge = original ? { ...original, data: draft } : undefined;
  const segments = edge ? segmentsForEdge(edge, nodes, edges, original?.data?.cableId ?? "Cable") : [];
  const patched = (draft.patchHops?.length ?? 0) > 0;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  if (!original || !edge) return null;
  const patchSegment = (index: number, patch: Partial<PatchSegmentOverride>) => setDraft(d => {
    if (!patched) return { ...d, ...patch };
    const segs = [...(d.patchSegments ?? [])]; segs[index] = { ...segs[index], ...patch };
    return { ...d, patchSegments: segs };
  });
  const save = () => {
    const cleanCable = (c: PhysicalCable): PhysicalCable => ({ ...c, supplier: c.supplier === undefined ? undefined : supplierName(c.supplier) });
    useSchematicStore.getState().patchEdgeData(edgeId, {
      ...draft, supplier: supplierName(draft.supplier) || undefined,
      cables: draft.cables?.map(cleanCable),
      patchSegments: draft.patchSegments?.map(s => ({ ...s, supplier: s.supplier === undefined ? undefined : supplierName(s.supplier), cables: s.cables?.map(cleanCable) })),
    });
    onClose();
  };
  return <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label="Physical signal path" className="bg-white rounded-lg shadow-xl w-[900px] max-w-[96vw] max-h-[90vh] overflow-auto p-5 text-xs" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between mb-3"><h2 className="font-semibold text-base">Physical signal path · {original.data?.cableId || "Connection"}</h2><button onClick={onClose}>×</button></div>
      <p className="text-neutral-500 mb-3">Add real cables and adapter cables in signal order. Each row counts as one cable. Fixed installation and provided material stay in the installation schedule and are excluded from the pack list.</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <label>Default supplier<SupplierInput value={draft.supplier ?? ""} onChange={supplier => setDraft(d => ({ ...d, supplier }))} /></label>
        <label>Default provision<div><ProvisionSelect value={draft.provision} onChange={provision => setDraft(d => ({ ...d, provision }))} /></div></label>
        <label>Default unit cost<input aria-label="Default unit cost" type="number" min="0" step="0.01" className="block border rounded p-1" value={draft.unitCost ?? ""} onChange={e => setDraft(d => ({ ...d, unitCost: e.target.value === "" ? undefined : Number(e.target.value) }))} /></label>
      </div>
      <label className="flex gap-2 mb-4"><input type="checkbox" checked={draft.physicalPathExpanded ?? false} onChange={e => setDraft(d => ({ ...d, physicalPathExpanded: e.target.checked }))} />Show expanded physical path on schematic</label>
      {(draft.patchHops ?? []).map((hop, i) => {
        const panel = nodes.find(n => n.id === hop.panelNodeId);
        const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === hop.portId) : undefined;
        return <div key={`${hop.panelNodeId}:${hop.portId}`} className="flex gap-3 items-center mb-2 bg-blue-50 p-2 rounded">
          <b>{String(panel?.data.label ?? "Panel")} · {port?.label || hop.portId}</b>
          <select aria-label={`Panel ${i + 1} direction`} className="border rounded p-1" value={hop.entryFace ?? "rear"} onChange={e => {
            const entryFace = e.target.value as "rear" | "front";
            setDraft(d => ({ ...d, patchHops: d.patchHops!.map((h, j) => j === i ? { ...h, entryFace } : h) }));
          }}><option value="rear">Rear → Front</option><option value="front">Front → Rear</option></select>
        </div>;
      })}
      <label className="flex gap-2 mb-3"><input type="checkbox" disabled={patched} checked={draft.directAttach ?? false} onChange={e => setDraft(d => ({ ...d, directAttach: e.target.checked || undefined }))} />Direct plug attachment (no separate cable)</label>
      {draft.directAttach && <p className="mb-3 text-neutral-500">This connection joins two plugs directly and creates no cable in reports.</p>}
      {!draft.directAttach && segments.map((seg, index) => {
        const meta = patched ? draft.patchSegments?.[index] : draft;
        const cables = meta?.cables?.length ? meta.cables : [{ id: `default-${index}`, cableLength: seg.cableLength || (!patched ? draft.cableLength : undefined) }];
        const setCables = (next: PhysicalCable[]) => patchSegment(index, { cables: next });
        const change = (i: number, patch: Partial<PhysicalCable>) => setCables(cables.map((c, j) => j === i ? { ...c, ...patch } : c));
        const incompatible = cables.some((c, i) => {
          const previous = i === 0 ? seg.from.port?.connectorType : cables[i - 1].targetConnector;
          const next = i === cables.length - 1 ? seg.to.port?.connectorType : cables[i + 1].sourceConnector;
          return (previous && c.sourceConnector && !areConnectorsCompatible(previous, c.sourceConnector)) || (next && c.targetConnector && !areConnectorsCompatible(c.targetConnector, next));
        });
        return <section key={index} className="border rounded p-3 mb-3">
          <h3 className="font-semibold mb-2">{seg.label}: {seg.from.label} / {seg.from.portLabel} → {seg.to.label} / {seg.to.portLabel}</h3>
          {patched && <div className="flex gap-2 items-center mb-2"><span>Section provision</span><ProvisionSelect value={meta?.provision ?? draft.provision} onChange={provision => patchSegment(index, { provision })} /></div>}
          <div className="grid grid-cols-[1fr_80px_1fr_1fr_1fr_85px_145px_24px] gap-1 text-[10px] text-neutral-500 mb-1"><span>Cable / adapter name</span><span>Length</span><span>Input connector</span><span>Output connector</span><span>Supplier</span><span>Unit cost</span><span>Provision</span><span /></div>
          {cables.map((c, i) => <div key={c.id} className="grid grid-cols-[1fr_80px_1fr_1fr_1fr_85px_145px_24px] gap-1 mb-2">
            <input aria-label="Cable name" className="border rounded p-1 min-w-0" placeholder="Automatic cable type" value={c.label ?? ""} onChange={e => change(i, { label: e.target.value })} />
            <input aria-label="Cable length" className="border rounded p-1 min-w-0" placeholder="e.g. 10m" value={c.cableLength ?? ""} onChange={e => change(i, { cableLength: e.target.value })} />
            <ConnectorSelect value={c.sourceConnector} onChange={sourceConnector => change(i, { sourceConnector })} />
            <ConnectorSelect value={c.targetConnector} onChange={targetConnector => change(i, { targetConnector })} />
            <SupplierInput value={c.supplier ?? meta?.supplier ?? draft.supplier ?? ""} onChange={supplier => change(i, { supplier })} />
            <input aria-label="Cable unit cost" className="border rounded p-1 min-w-0" type="number" min="0" step="0.01" value={c.unitCost ?? meta?.unitCost ?? draft.unitCost ?? ""} onChange={e => change(i, { unitCost: e.target.value === "" ? undefined : Number(e.target.value) })} />
            <ProvisionSelect value={c.provision ?? meta?.provision ?? draft.provision} onChange={provision => change(i, { provision })} />
            <button title="Remove cable" disabled={cables.length === 1} onClick={() => setCables(cables.filter((_, j) => j !== i))}>×</button>
          </div>)}
          {incompatible && <p className="text-amber-700 mb-2">Connector mismatch in this section. Check the cable ends or add an adapter cable.</p>}
          <button className="text-blue-600" onClick={() => setCables([...cables, { id: crypto.randomUUID() }])}>+ Add inline cable / adapter cable</button>
        </section>;
      })}
      <div className="flex justify-end gap-3"><button onClick={onClose}>Cancel</button><button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={save}>Save</button></div>
    </div>
  </div>;
}
