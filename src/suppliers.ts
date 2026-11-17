import type { ConnectionEdge, DeviceData, Provision, SchematicNode } from "./types";

export function supplierKey(value?: string): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function supplierName(value?: string): string { return (value ?? "").trim().replace(/\s+/g, " "); }
export function usedSuppliers(nodes: SchematicNode[], edges: ConnectionEdge[]): string[] {
  const names = new Map<string, string>();
  const add = (v?: string) => { const n = supplierName(v); if (n && !names.has(supplierKey(n))) names.set(supplierKey(n), n); };
  for (const n of nodes) if (n.type === "device") add((n.data as DeviceData).supplier);
  for (const e of edges) {
    add(e.data?.supplier);
    for (const c of e.data?.cables ?? []) add(c.supplier);
    for (const seg of e.data?.patchSegments ?? []) {
      add(seg?.supplier);
      for (const c of seg?.cables ?? []) add(c.supplier);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
export const PROVISION_LABELS: Record<Provision, string> = { bring: "Bring / procure", installed: "Fixed installation", provided: "Provided on site" };
export function includedInPackList(provision?: Provision): boolean { return !provision || provision === "bring"; }
