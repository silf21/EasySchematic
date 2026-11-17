import { patchSectionStubEnds } from "../patchSectionStubs";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import { useSchematicStore } from "../store";
import { LINE_STYLE_DASHARRAY, type ConnectionEdge } from "../types";
import { includedInPackList } from "../suppliers";
import { signalCssColor } from "../typeRegistry";

export default function PatchReferenceEdge(props: EdgeProps<ConnectionEdge>) {
  const { id, data, selected, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const route = useSchematicStore(s => s.routedEdges[id]);
  const jumps = useSchematicStore(s => s.showLineJumps);
  const showIds = useSchematicStore(s => s.showCableIdLabels);
  const showLengths = useSchematicStore(s => s.showCableLengthLabels);
  const nodes = useSchematicStore(s => s.nodes);
  const hidden = useSchematicStore(s => s.hiddenVirtualEdgeIds.has(id));
  const [fallback, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  if (hidden) return null;
  const fixed = !includedInPackList(data?.supplier);
  const path = (jumps && route?.svgPathWithHops) || route?.svgPath || fallback;
  const cableId = showIds && !data?.hideCableId ? data?.cableId : "";
  const length = showLengths ? data?.cableLength : "";
  const label = [cableId, length, fixed && (cableId || length) ? "Festinstalliert" : ""].filter(Boolean).join(" · ");
  const style = { ...props.style, stroke: data?.directAttach ? "#9ca3af" : data?.color ?? props.style?.stroke ?? signalCssColor(data?.signalType ?? "custom"), strokeWidth: data?.directAttach ? 1 : selected ? 3 : 2, strokeDasharray: fixed ? "6 4" : LINE_STYLE_DASHARRAY[data?.lineStyle ?? "solid"] };
  if (data?.patchSectionStubbed) {
    const ends = patchSectionStubEnds({ ...props, sourceHandle: props.sourceHandleId, targetHandle: props.targetHandleId } as ConnectionEdge, nodes,
      { x: sourceX, y: sourceY, side: sourcePosition === "left" ? "left" : "right" },
      { x: targetX, y: targetY, side: targetPosition === "right" ? "right" : "left" });
    return <>{ends.map((end, i) => <BaseEdge key={i} id={`${id}:stub:${i}`} path={`M ${end.x} ${end.y} L ${end.endX} ${end.endY}`} interactionWidth={props.interactionWidth} style={style} />)}
      <EdgeLabelRenderer>{ends.map((end, i) => <div key={i} data-testid="patch-section-stub" className="nodrag nopan text-[9px] leading-3 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded px-1 py-0.5 whitespace-nowrap"
        onContextMenu={event => {
          event.preventDefault(); event.stopPropagation();
          if (!data.patchReference) return;
          useSchematicStore.setState({ edgeContextMenu: { edgeId: data.patchReference.edgeId, segmentIndex: data.patchReference.segmentIndex, screenX: event.clientX, screenY: event.clientY, flowX: end.endX, flowY: end.endY } });
        }}
        style={{ position: "absolute", pointerEvents: "all", transform: `translate(${end.side === "right" ? "0" : "-100%"}, -50%) translate(${end.endX}px, ${end.endY}px)` }}>{end.text}</div>)}</EdgeLabelRenderer>
    </>;
  }
  return <>
    <BaseEdge id={id} path={path} interactionWidth={props.interactionWidth} style={style} />
    {!data?.directAttach && label && <EdgeLabelRenderer><div className="text-[10px] bg-[var(--color-surface)] text-[var(--color-text)] px-1 rounded" style={{ position: "absolute", pointerEvents: "none", transform: `translate(-50%, -50%) translate(${route?.labelX ?? labelX}px, ${route?.labelY ?? labelY}px)` }}>
      {label}
    </div></EdgeLabelRenderer>}
  </>;
}
