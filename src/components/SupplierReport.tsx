import { useState } from "react";
import { useSchematicStore } from "../store";
import { computeSupplierMaterials, supplierGroups } from "../supplierReport";
import { formatCurrency } from "../auxiliaryData";

export default function SupplierReport() {
  const nodes = useSchematicStore(s => s.nodes);
  const edges = useSchematicStore(s => s.edges);
  const pages = useSchematicStore(s => s.pages);
  const costs = useSchematicStore(s => s.cableCosts);
  const currency = useSchematicStore(s => s.currency);
  const [filter, setFilter] = useState("");
  const [groupBy, setGroupBy] = useState<"category" | "room">("category");
  const rows = computeSupplierMaterials(nodes, edges, pages, costs).filter(r => [r.supplier, r.material, r.room, r.category].join(" ").toLowerCase().includes(filter.toLowerCase()));
  return <div className="text-xs">
    <p className="text-neutral-500 mb-3">Materials to supply, grouped by supplier. Supplier “Festinstalliert” is excluded here and remains documented in the Cable Schedule. Costs use the project currency ({currency}). Zero-price items are listed as unpriced.</p>
    <div className="flex gap-3 mb-3"><input aria-label="Filter supplier materials" className="border rounded p-2 flex-1" placeholder="Filter supplier, material, room…" value={filter} onChange={e => setFilter(e.target.value)} /><label>Within supplier: <select value={groupBy} onChange={e => setGroupBy(e.target.value as "category" | "room")}><option value="category">Category</option><option value="room">Room / route</option></select></label></div>
    {supplierGroups(rows).map(g => <section key={g.supplier} className="mb-5 border rounded overflow-hidden">
      <h3 className="font-semibold bg-blue-50 p-2">{g.supplier} · {g.count} items · {formatCurrency(g.cost, currency)}{g.unpriced ? ` · ${g.unpriced} unpriced` : ""}</h3>
      <table className="w-full text-left"><thead><tr>{["Category", "Material", "Room / Route", "Qty", "Unit Cost", "Cost"].map(h => <th key={h} className="p-2 border-b">{h}</th>)}</tr></thead><tbody>
        {[...g.rows].sort((a, b) => a[groupBy].localeCompare(b[groupBy])).map((r, i) => <tr key={i}><td className="p-2">{r.category}</td><td>{r.material}</td><td>{r.room}</td><td>{r.count}</td><td>{r.unitCost ? formatCurrency(r.unitCost, currency) : "—"}</td><td>{r.cost ? formatCurrency(r.cost, currency) : "—"}</td></tr>)}
        <tr className="font-semibold border-t"><td className="p-2" colSpan={3}>Subtotal</td><td>{g.count}</td><td /><td>{formatCurrency(g.cost, currency)}</td></tr>
      </tbody></table>
    </section>)}
    <p className="font-semibold">Total: {formatCurrency(rows.reduce((n, r) => n + r.cost, 0), currency)}</p>
  </div>;
}
