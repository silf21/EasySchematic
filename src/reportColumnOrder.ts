/** Stable column identities shared by report tables and their print layouts. */
export const reportColumnOrderKey = (tableId: string) => `column-order:${tableId}`;
export function reportColumnId(label: string): string {
  return label.replace(/#/g, " number ").replace(/[▴▾▲▼↑↓]/g, "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
export function readReportColumnOrder(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
}
export function orderReportColumns<T>(columns: readonly T[], order: readonly string[], id: (column: T) => string): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return columns.map((column, index) => ({ column, index })).sort((a, b) => (rank.get(id(a.column)) ?? order.length + a.index) - (rank.get(id(b.column)) ?? order.length + b.index)).map(item => item.column);
}
/** Retain hidden columns while rearranging the currently visible subset. */
export function mergeVisibleColumnOrder(saved: string[], visible: string[], next: string[]): string[] {
  const base = [...new Set([...saved, ...visible])];
  const shown = new Set(visible); let i = 0;
  return base.map(id => shown.has(id) ? next[i++] : id);
}
