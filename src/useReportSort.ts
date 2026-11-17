import { useMemo } from "react";
import { useSchematicStore } from "./store";
import { readReportSort, reportSortKey, sortReportRows, reportSortValue } from "./reportSort";
export function useReportSort<T>(tableId: string, rows: readonly T[], value: (row: T, id: string) => unknown = reportSortValue): T[] {
  const saved = useSchematicStore(s => s.reportLayouts[reportSortKey(tableId)]);
  return useMemo(() => sortReportRows(rows, readReportSort(saved), value), [rows, saved, value]);
}
