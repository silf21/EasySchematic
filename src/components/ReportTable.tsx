import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { useSchematicStore } from "../store";
import { mergeVisibleColumnOrder, orderReportColumns, readReportColumnOrder, reportColumnId, reportColumnOrderKey } from "../reportColumnOrder";

interface Column { id: string; label: string }
const Context = createContext<{ columns: Column[]; order: string[]; register: (columns: Column[]) => void } | null>(null);
function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return "";
}
export function ReportTable({ tableId, children, ...props }: HTMLAttributes<HTMLTableElement> & { tableId: string }) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [dragged, setDragged] = useState<string | null>(null);
  const key = reportColumnOrderKey(tableId);
  const saved = useSchematicStore(s => s.reportLayouts[key]);
  const setLayout = useSchematicStore(s => s.setReportLayout);
  const order = useMemo(() => readReportColumnOrder(saved), [saved]);
  const register = useCallback((next: Column[]) => setColumns(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next), []);
  const context = useMemo(() => ({ columns, order, register }), [columns, order, register]);
  const shown = orderReportColumns(columns, order, c => c.id);
  const move = (id: string, index: number) => {
    const ids = shown.map(c => c.id); const from = ids.indexOf(id);
    if (from < 0 || index < 0 || index >= ids.length || from === index) return;
    ids.splice(from, 1); ids.splice(index, 0, id);
    setLayout(key, mergeVisibleColumnOrder(order, columns.map(c => c.id), ids));
  };
  return <Context.Provider value={context}>
    <details className="mb-2 text-xs" data-testid={`column-order-${tableId}`} onKeyDown={e => e.stopPropagation()}>
      <summary className="cursor-pointer text-[var(--color-text-muted)]">Column order</summary>
      <div className="p-2 border border-[var(--color-border)] rounded bg-[var(--color-surface)] max-w-md max-h-64 overflow-y-auto">
        <p className="text-[var(--color-text-muted)] mb-2">Drag columns or use the arrows. Saved with this project.</p>
        {shown.map((column, i) => <div key={column.id} draggable onDragStart={e => { setDragged(column.id); e.dataTransfer.setData("text/plain", column.id); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragged) move(dragged, i); setDragged(null); }} className="flex items-center gap-2 py-1 cursor-grab">
          <span aria-hidden>☰</span><span className="flex-1">{column.label}</span>
          <button type="button" aria-label={`Move ${column.label} left`} disabled={i === 0} onClick={() => move(column.id, i - 1)} className="px-2 disabled:opacity-30">←</button>
          <button type="button" aria-label={`Move ${column.label} right`} disabled={i === shown.length - 1} onClick={() => move(column.id, i + 1)} className="px-2 disabled:opacity-30">→</button>
        </div>)}
        <button type="button" onClick={() => setLayout(key, [])} className="mt-2 underline">Reset column order</button>
      </div>
    </details>
    <table data-report-table={tableId} {...props}>{children}</table>
  </Context.Provider>;
}
/** Reorder React cells (including editable components), never mutate DOM owned by React. */
export function ReportRow({ children, header: headerProp = false, ...props }: HTMLAttributes<HTMLTableRowElement> & { header?: boolean }) {
  const context = useContext(Context);
  const cells = Children.toArray(children).filter(isValidElement) as ReactElement<{ children?: ReactNode; colSpan?: number }>[];
  const header = headerProp || (cells.length > 0 && cells.every(cell => cell.type === "th"));
  const signature = header ? JSON.stringify(cells.map((cell, i) => { const label = textContent(cell.props.children).replace(/[▴▾▲▼↑↓]/g, "").trim() || "Actions"; return { id: reportColumnId(label) || `column${i}`, label }; })) : "";
  const register = context?.register;
  useLayoutEffect(() => { if (signature && register) register(JSON.parse(signature) as Column[]); }, [signature, register]);
  if (!context || !cells.length || cells.some(cell => (cell.props.colSpan ?? 1) > 1) || !context.columns.length) return <tr {...props}>{children}</tr>;
  const ids = header ? (JSON.parse(signature) as Column[]).map(c => c.id) : context.columns.map(c => c.id);
  if (cells.length > ids.length) return <tr {...props}>{children}</tr>;
  const indexed = ids.map((id, i) => ({ id, cell: cells[i] ?? <td key={id} /> }));
  return <tr {...props}>{orderReportColumns(indexed, context.order, c => c.id).map(c => cloneElement(c.cell, { key: c.id }))}</tr>;
}
