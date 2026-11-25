import { useId } from "react";
import { useSchematicStore } from "../store";
import { usedSuppliers } from "../suppliers";

export default function SupplierInput({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const id = useId();
  const nodes = useSchematicStore(s => s.nodes);
  const edges = useSchematicStore(s => s.edges);
  return <><input aria-label="Supplier" className={className ?? "w-full border rounded px-2 py-1 text-xs"} list={id} value={value}
    onDoubleClick={e => e.stopPropagation()} placeholder="Supplier…" onChange={e => onChange(e.target.value)} onKeyDown={e => e.stopPropagation()} />
    <datalist id={id}>{usedSuppliers(nodes, edges).map(name => <option key={name} value={name} />)}</datalist></>;
}
