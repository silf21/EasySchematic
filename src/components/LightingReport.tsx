import { useState } from "react";
import { useSchematicStore } from "../store";
import { computeLightingReport, LIGHTING_COLUMNS } from "../lightingReport";

export default function LightingReport({ onEdit }: { onEdit: (nodeId: string) => void }) {
  const nodes = useSchematicStore(s => s.nodes);
  const [filter, setFilter] = useState("");
  const rows = computeLightingReport(nodes).filter(row => LIGHTING_COLUMNS.some(c => row[c.key].toLowerCase().includes(filter.toLowerCase())));
  return <div className="text-xs">
    <p className="text-[var(--color-text-muted)] mb-3">Virtual channels and individually configured lighting ports. Art-Net universes start at 0; sACN and logical local DMX universes start at 1. IP configuration and DMX addressing are independent. Virtual channel fields depend on their protocol; universe mappings are entered explicitly.</p>
    <input className="w-full border border-[var(--color-border)] rounded p-2 mb-3" aria-label="Filter lighting report" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter device, universe, mode or IP…" />
    {!rows.length ? <p className="py-6 text-center text-[var(--color-text-muted)]">Add a Virtual Channel or configure DMX / Universe on a lighting port in Device Properties.</p> : <table className="w-full text-left border-collapse"><thead><tr>{LIGHTING_COLUMNS.map(c => <th className="p-2 border-b border-[var(--color-border)]" key={c.key}>{c.header}</th>)}<th /></tr></thead><tbody>{rows.map(row => <tr key={`${row.nodeId}:${row.portId}`}>
      {LIGHTING_COLUMNS.map(c => <td key={c.key} className={`p-2 border-b border-[var(--color-border)] ${c.key === "warnings" ? "text-amber-600" : ""}`}>{row[c.key]}</td>)}
      <td><button className="text-blue-600 p-2" onClick={() => onEdit(row.nodeId)}>Edit</button></td>
    </tr>)}</tbody></table>}
  </div>;
}
