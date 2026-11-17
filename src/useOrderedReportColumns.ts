import { useMemo } from "react";
import { useSchematicStore } from "./store";
import { orderReportColumns, readReportColumnOrder, reportColumnId, reportColumnOrderKey } from "./reportColumnOrder";

export function useOrderedReportColumns<T extends { header: string }>(tableId: string, columns: readonly T[]): T[] {
  const saved = useSchematicStore(s => s.reportLayouts[reportColumnOrderKey(tableId)]);
  return useMemo(() => orderReportColumns(columns, readReportColumnOrder(saved), col => reportColumnId(col.header)), [columns, saved]);
}
