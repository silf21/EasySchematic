import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useSchematicStore } from "../store";
import { LINE_STYLE_DASHARRAY, type ConnectionEdge } from "../types";
import { includedInPackList } from "../suppliers";
import { signalCssColor } from "../typeRegistry";

export default function PatchReferenceEdge(props: EdgeProps<ConnectionEdge>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const route = useSchematicStore(s => s.routedEdges[id]);
  const jumps = useSchematicStore(s => s.showLineJumps);
  const hidden = useSchematicStore(s => s.hiddenVirtualEdgeIds.has(id));
  const [fallback, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  if (hidden) return null;
  const fixed = !includedInPackList(data?.supplier);
  const path = (jumps && route?.svgPathWithHops) || route?.svgPath || fallback;
  return <>
    <BaseEdge id={id} path={path} interactionWidth={props.interactionWidth} style={{ ...props.style, stroke: data?.directAttach ? "#9ca3af" : data?.color ?? props.style?.stroke ?? signalCssColor(data?.signalType ?? "custom"), strokeWidth: data?.directAttach ? 1 : selected ? 3 : 2, strokeDasharray: fixed ? "6 4" : LINE_STYLE_DASHARRAY[data?.lineStyle ?? "solid"] }} />
    {!data?.directAttach && !data?.hideCableId && <EdgeLabelRenderer><div className="text-[10px] bg-[var(--color-surface)] text-[var(--color-text)] px-1 rounded" style={{ position: "absolute", pointerEvents: "none", transform: `translate(-50%, -50%) translate(${route?.labelX ?? labelX}px, ${route?.labelY ?? labelY}px)` }}>
      {data?.cableId}{data?.cableLength ? ` · ${data.cableLength}` : ""}{fixed ? " · Festinstalliert" : ""}
    </div></EdgeLabelRenderer>}
  </>;
}
