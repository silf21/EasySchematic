import type { ConnectionEdge, DeviceData, SchematicNode } from "./types";

export const INSTALLED_SUPPLIER = "Festinstalliert";
export function supplierKey(value?: string): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
export function supplierName(value?: string): string {
  const name = (value ?? "").trim().replace(/\s+/g, " ");
  return supplierKey(name) === supplierKey(INSTALLED_SUPPLIER) ? INSTALLED_SUPPLIER : name;
}
export function includedInPackList(supplier?: string): boolean {
  return supplierKey(supplier) !== supplierKey(INSTALLED_SUPPLIER);
}
export function usedSuppliers(nodes: SchematicNode[], edges: ConnectionEdge[]): string[] {
  const names = new Map<string, string>([[supplierKey(INSTALLED_SUPPLIER), INSTALLED_SUPPLIER]]);
  const add = (value?: string) => { const name = supplierName(value); if (name && !names.has(supplierKey(name))) names.set(supplierKey(name), name); };
  for (const node of nodes) if (node.type === "device") add((node.data as DeviceData).supplier);
  for (const edge of edges) {
    add(edge.data?.supplier);
    for (const segment of edge.data?.patchSegments ?? []) add(segment?.supplier);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
