import { useMemo } from "react";
import { useSchematicStore } from "../store";
import { readReportSort, reportSortKey, type ReportSortRule } from "../reportSort";

export function ReportSortEditor({ tableId, columns }: { tableId: string; columns: readonly { id: string; label: string }[] }) {
  const saved = useSchematicStore(s => s.reportLayouts[reportSortKey(tableId)]);
  const setLayout = useSchematicStore(s => s.setReportLayout);
  const sorting = useMemo(() => readReportSort(saved), [saved]);
  const setSorting = (rules: ReportSortRule[]) => setLayout(reportSortKey(tableId), rules);
  const sortable = columns.filter(column => column.id !== "label" && column.id !== "actions");
  return (
    <details className="mb-2 text-xs" data-testid={`sort-priority-${tableId}`} onKeyDown={e => e.stopPropagation()}>
      <summary className="cursor-pointer text-[var(--color-text-muted)]">Sort priority{sorting.length ? ` (${sorting.length})` : ""}</summary>
      <div className="p-2 border border-[var(--color-border)] rounded max-w-xl">
        <p className="mb-2 text-[var(--color-text-muted)]">Rules apply from top to bottom, within existing groups. Click a header to sort; Shift-click to add a level.</p>
        {sorting.map((rule, index) => <div key={rule.id} className="flex items-center gap-1 mb-1">
          <span>{index + 1}.</span>
          <select aria-label={`Sort column ${index + 1}`} value={rule.id} onChange={e => setSorting(sorting.map((r, i) => i === index ? { ...r, id: e.target.value, label: sortable.find(c => c.id === e.target.value)?.label } : r))} className="border rounded p-1 min-w-0 flex-1 bg-[var(--color-surface)]">
            {!sortable.some(c => c.id === rule.id) && <option value={rule.id}>{rule.label ?? rule.id} (hidden)</option>}
            {sortable.filter(c => c.id === rule.id || !sorting.some(r => r.id === c.id)).map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
          </select>
          <select aria-label={`Sort direction ${index + 1}`} value={rule.direction} onChange={e => setSorting(sorting.map((r, i) => i === index ? { ...r, direction: e.target.value as "asc" | "desc" } : r))} className="border rounded p-1 bg-[var(--color-surface)]"><option value="asc">Ascending</option><option value="desc">Descending</option></select>
          {[-1, 1].map(delta => <button key={delta} type="button" aria-label={`${delta < 0 ? "Increase" : "Decrease"} priority ${index + 1}`} disabled={index + delta < 0 || index + delta >= sorting.length} className="px-1 disabled:opacity-30" onClick={() => { const next = [...sorting]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setSorting(next); }}>{delta < 0 ? "↑" : "↓"}</button>)}
          <button type="button" aria-label={`Remove sort ${index + 1}`} onClick={() => setSorting(sorting.filter((_, i) => i !== index))}>×</button>
        </div>)}
        <button type="button" disabled={!sortable.some(c => !sorting.some(r => r.id === c.id))} className="underline mr-3 disabled:opacity-30" onClick={() => { const c = sortable.find(c => !sorting.some(r => r.id === c.id)); if (c) setSorting([...sorting, { id: c.id, label: c.label, direction: "asc" }]); }}>Add sort level</button>
        <button type="button" className="underline" onClick={() => setSorting([])}>Reset sorting</button>
      </div>
    </details>
  );
}
