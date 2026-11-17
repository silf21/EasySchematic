import type { ConnectionData } from "./types";
import type { CableScheduleRow } from "./cableSchedule";

/** Route an inline row edit to its real cable instead of changing the whole logical connection. */
export function physicalMaterialEdit(data: ConnectionData, row: CableScheduleRow, column: "cableId" | "cableLength", value: string): Partial<ConnectionData> {
  const patch = column === "cableId" ? { cableId: value || undefined } : { cableLength: value };
  if (row.materialIndex === undefined) return patch;
  if (row.segIndex === undefined) return { cables: data.cables?.map((c, i) => i === row.materialIndex ? { ...c, ...patch } : c) };
  const segs = [...(data.patchSegments ?? [])];
  const seg = segs[row.segIndex];
  segs[row.segIndex] = { ...seg, cables: seg?.cables?.map((c, i) => i === row.materialIndex ? { ...c, ...patch } : c) };
  return { patchSegments: segs };
}
