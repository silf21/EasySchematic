import { reportColumnId } from "./reportColumnOrder";
export interface ReportSortRule { id: string; direction: "asc" | "desc"; label?: string }
export const reportSortKey = (tableId: string) => `row-sort:${tableId}`;
export function readReportSort(value: unknown): ReportSortRule[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rules: ReportSortRule[] = [];
  for (const rule of value) {
    if (!rule || typeof rule.id !== "string" || !rule.id || !["asc", "desc"].includes(rule.direction) || seen.has(rule.id)) continue;
    seen.add(rule.id);
    rules.push({ id: rule.id, direction: rule.direction, ...(typeof rule.label === "string" ? { label: rule.label } : {}) });
  }
  return rules;
}
const aliases: Record<string, string[]> = {
  device: ["label", "deviceLabel", "device", "model"], port: ["portLabel", "port"], channelport: ["port"],
  type: ["deviceType", "type", "rackType"], qty: ["count"], ports: ["portCount"], owned: ["ownedCount"], need: ["neededCount"],
  signal: ["signalType", "signal"], length: ["cableLength"], source: ["sourceDevice"], target: ["targetDevice"],
  srcport: ["sourcePort"], tgtport: ["targetPort"], srcconn: ["sourceConnector"], tgtconn: ["targetConnector"],
  srcroom: ["sourceRoom"], tgtroom: ["targetRoom"], estlength: ["computedLength"], gauge: ["gaugeAwg"], alias: ["cableAlias"],
  use: ["cableUse"], snake: ["multicableLabel"], start: ["startAddress"], end: ["endAddress"], channels: ["footprint"],
  configuration: ["mode"], validation: ["warnings"], distro: ["label"], capacityw: ["capacityW"], loadw: ["loadW"], load: ["loadPercent"],
  powerw: ["powerDrawW"], totalw: ["totalPowerW"], thermalbtuh: ["thermalBtuh"], totalbtuh: ["totalThermalBtuh"],
  poolstart: ["rangeStart"], poolend: ["rangeEnd"], subnet: ["subnetMask"], poew: ["poeDrawW"],
  budgetw: ["budgetW"], remainingw: ["remainingW"], dhcpserver: ["dhcpServerLabel"], position: ["portLabel"],
  accessory: ["model"], rack: ["label"], height: ["heightU"], cabletype: ["cableType", "model"],
};
export function reportSortValue(row: unknown, id: string): unknown {
  const record = row as Record<string, unknown>;
  for (const key of Object.hasOwn(aliases, id) ? aliases[id] : []) if (record[key] !== undefined) return record[key];
  const key = Object.keys(record).find(key => reportColumnId(key) === id);
  if (key) return record[key];
  if (id === "status" && typeof record.overBudget === "boolean") return record.overBudget ? "Over budget" : "OK";
  if (id === "totalw") return Number(record.powerDrawW ?? 0) * Number(record.count ?? 0);
  if (id === "totalbtuh") return Number(record.thermalBtuh ?? 0) * Number(record.count ?? 0);
  if (id === "extcost") return Number(record.unitCost ?? 0) * Number(record.count ?? 0);
  return "";
}
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export function compareReportRows<T>(a: T, b: T, rules: readonly ReportSortRule[], value: (row: T, id: string) => unknown = reportSortValue): number {
  for (const rule of rules) {
    const av = value(a, rule.id), bv = value(b, rule.id);
    const emptyA = av === undefined || av === null || av === "", emptyB = bv === undefined || bv === null || bv === "";
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : typeof av === "boolean" && typeof bv === "boolean" ? Number(av) - Number(bv) : collator.compare(String(av ?? ""), String(bv ?? ""));
    if (cmp) return rule.direction === "desc" ? -cmp : cmp;
  }
  return 0;
}
export function sortReportRows<T>(rows: readonly T[], rules: readonly ReportSortRule[], value?: (row: T, id: string) => unknown): T[] {
  if (!rules.length) return rows as T[];
  return rows.map((row, index) => ({ row, index })).sort((a, b) => compareReportRows(a.row, b.row, rules, value) || a.index - b.index).map(item => item.row);
}
/** Keep expansion-card rows with their parent device and summary rows at the end. */
export function sortReportBlocks(rows: Record<string, string>[], rules: readonly ReportSortRule[], value?: (row: Record<string, string>, id: string) => unknown): Record<string, string>[] {
  if (!rules.length) return rows;
  const blocks: Record<string, string>[][] = []; const totals: Record<string, string>[] = [];
  for (const row of rows) {
    if (row._rowKind) { totals.push(row); continue; }
    if (row._isSubItem === "true" && blocks.length) blocks[blocks.length - 1].push(row);
    else blocks.push([row]);
  }
  return [...sortReportRows(blocks, rules, (block, id) => value ? value(block[0], id) : reportSortValue(block[0], id)).flat(), ...totals];
}

/** Compare formatted PDF numbers using the same values as the on-screen report. */
export function reportSortDisplayValue(value: unknown, id: string): unknown {
  if (typeof value !== "string") return value;
  if (["unitcost", "extcost", "powerw", "totalw", "thermalbtuh", "totalbtuh"].includes(id) && (value === "" || value === "—")) return 0;
  if (!["qty", "ports", "owned", "need", "unitcost", "extcost", "capacityw", "loadw", "load", "powerw", "totalw", "thermalbtuh", "totalbtuh", "poew", "budgetw", "remainingw", "height"].includes(id)) return value;
  const numeric = value.replace(/[$€£~,]/g, "").replace(/(?:x|×|%|U)$/i, "").trim();
  return /^-?\d+(?:\.\d+)?$/.test(numeric) ? Number(numeric) : value;
}

export function toggleReportSort(current: ReportSortRule[], column: { id: string; label: string }, additive: boolean, implicit?: ReportSortRule): ReportSortRule[] {
  const previous = additive ? current.length ? current : implicit ? [implicit] : [] : current[0]?.id === column.id ? [current[0]] : [];
  const existing = previous.find(rule => rule.id === column.id);
  const oldDirection = existing?.direction ?? (!current.length && implicit?.id === column.id ? implicit.direction : undefined);
  const direction = oldDirection === "asc" ? "desc" : "asc";
  return existing ? previous.map(rule => rule.id === column.id ? { ...rule, direction } : rule) : [...previous, { ...column, direction }];
}
