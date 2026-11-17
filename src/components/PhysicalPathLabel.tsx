import { useSchematicStore } from "../store";
import { segmentsForEdge, entryFace, exitFace } from "../patchCircuits";
import { PROVISION_LABELS } from "../suppliers";
import { connectorLabel } from "../typeRegistry";
import { openPhysicalPath } from "../physicalPathEvents";

/** A derived schematic annotation. It never creates nodes, connections or material. */
export default function PhysicalPathLabel({ edgeId, x, y }: { edgeId: string; x: number; y: number }) {
  const nodes = useSchematicStore(s => s.nodes);
  const edges = useSchematicStore(s => s.edges);
  const edge = edges.find(e => e.id === edgeId);
  if (!edge?.data || (!edge.data.patchHops?.length && !edge.data.cables?.length)) return null;
  const data = edge.data;
  const segments = segmentsForEdge(edge, nodes, edges, data.cableId ?? "Cable");
  const expanded = data.physicalPathExpanded;
  const via = (data.patchHops ?? []).map(h => {
    const panel = nodes.find(n => n.id === h.panelNodeId);
    const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === h.portId) : undefined;
    return `${panel?.data.label ?? "Panel"} / ${port?.label ?? h.portId} (${entryFace(h)} → ${exitFace(h)})`;
  });
  return <div className="nodrag nopan nowheel text-[10px] text-neutral-800 border border-blue-300 rounded bg-white shadow-sm" style={{ position: "absolute", transform: `translate(-50%, 8px) translate(${x}px, ${y}px)`, pointerEvents: "all", maxWidth: expanded ? undefined : 340 }} onDoubleClick={() => openPhysicalPath(edgeId)}>
    <div className="flex gap-2 items-center px-2 py-1">
      <button aria-label={expanded ? "Collapse physical path" : "Expand physical path"} onClick={() => useSchematicStore.getState().patchEdgeData(edgeId, { physicalPathExpanded: !expanded })}>{expanded ? "▾" : "▸"}</button>
      <span className="truncate" title={via.join(" → ")}>{expanded ? "Physical signal path" : via.length ? `via ${via.join(" → ")}` : "Inline cables / adapters"}</span>
      <button aria-label="Edit physical signal path" className="text-blue-600 ml-auto" onClick={() => openPhysicalPath(edgeId)}>Edit</button>
    </div>
    {expanded && <div className="flex items-center gap-1 p-2 border-t border-blue-100">
      <div className="border rounded bg-neutral-100 p-2 max-w-36">{segments[0]?.from.label}<br />{segments[0]?.from.portLabel}</div>
      {segments.map((s, i) => {
        const meta = data.patchHops?.length ? data.patchSegments?.[i] : data;
        const cables = meta?.cables?.length ? meta.cables : [{ id: "default", cableLength: s.cableLength, label: s.label }];
        const hop = data.patchHops?.[i];
        return <div key={i} className="flex items-center gap-1">
          {cables.map((c, j) => {
            const provision = c.provision ?? meta?.provision ?? data.provision ?? "bring";
            return <div key={c.id} className="flex items-center gap-1"><span>→</span><div title={PROVISION_LABELS[provision]} className={`border rounded p-2 min-w-24 max-w-40 ${provision === "bring" ? "border-blue-300 bg-blue-50" : "border-dashed border-neutral-400 bg-neutral-50"}`}>
              <b>{c.label || `${s.label}${cables.length > 1 ? `.${j + 1}` : ""}`}</b>
              {(c.sourceConnector || c.targetConnector) && <div>{c.sourceConnector ? connectorLabel(c.sourceConnector) : "…"} → {c.targetConnector ? connectorLabel(c.targetConnector) : "…"}</div>}
              <div>{c.cableLength}</div><div className="text-neutral-500">{PROVISION_LABELS[provision]}</div>
            </div></div>;
          })}
          <span>→</span><div className="border rounded bg-neutral-100 p-2 max-w-36"><b>{s.to.label}</b><div>{s.to.portLabel}</div>{hop && <div className="text-blue-700">{entryFace(hop)} → {exitFace(hop)}</div>}</div>
        </div>;
      })}
    </div>}
  </div>;
}
