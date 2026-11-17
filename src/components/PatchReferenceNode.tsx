import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";
import { useSchematicStore } from "../store";
import type { PatchReferenceNode as ReferenceNode } from "../types";
import { entryFace, exitFace } from "../patchCircuits";
import { signalCssColor } from "../typeRegistry";

export default function PatchReferenceNode({ id, data, selected }: NodeProps<ReferenceNode>) {
  const panel = useSchematicStore(s => s.nodes.find(n => n.id === data.panelNodeId));
  const edge = useSchematicStore(s => s.edges.find(e => e.id === data.connectionId));
  const update = useUpdateNodeInternals();
  const hop = edge?.data?.patchHops?.find(h => h.panelNodeId === data.panelNodeId && h.portId === data.portId);
  const left = hop ? entryFace(hop) : "rear";
  const right = hop ? exitFace(hop) : "front";
  useEffect(() => { update(id); }, [id, left, update]);
  const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === data.portId) : undefined;
  const color = signalCssColor(edge?.data?.signalType ?? "custom");
  return <div data-testid="patch-reference" className={`rounded border-2 bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm ${selected ? "border-blue-500" : "border-[var(--color-border)]"}`} style={{ width: 220, height: 80 }}>
    <div className="px-2 py-1 text-xs font-semibold truncate border-b border-[var(--color-border)]" title={String(panel?.data.label ?? "Panel")}>{String(panel?.data.label ?? "Panel")}</div>
    <div className="text-center text-xs font-semibold pt-1 truncate" style={{ color }}>{port?.label || data.portId}</div>
    <div className="flex justify-between px-3 text-[10px] capitalize"><span>{left}</span><span className="opacity-40">············</span><span>{right}</span></div>
    <Handle type="source" id={left} position={Position.Left} isConnectable={false} style={{ top: 60, background: color }} />
    <Handle type="source" id={right} position={Position.Right} isConnectable={false} style={{ top: 60, background: color }} />
  </div>;
}
