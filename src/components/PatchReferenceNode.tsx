import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";
import { useSchematicStore } from "../store";
import type { PatchReferenceNode as ReferenceNode } from "../types";
import { entryFace, exitFace } from "../patchCircuits";
import { signalCssColor } from "../typeRegistry";
import { contrastingTextColor } from "../colorContrast";
import { PATCH_REFERENCE_WIDTH, PATCH_REFERENCE_HEIGHT, PATCH_REFERENCE_HANDLE_Y } from "../patchReferences";
import { openPatchBay } from "../patchBayNavigation";

export default function PatchReferenceNode({ id, data, selected }: NodeProps<ReferenceNode>) {
  const panel = useSchematicStore(s => s.nodes.find(n => n.id === data.panelNodeId));
  const edge = useSchematicStore(s => s.edges.find(e => e.id === data.connectionId));
  const update = useUpdateNodeInternals();
  const hop = edge?.data?.patchHops?.find(h => h.panelNodeId === data.panelNodeId && h.portId === data.portId);
  const left = hop ? entryFace(hop) : "rear";
  const right = hop ? exitFace(hop) : "front";
  useEffect(() => { update(id); }, [id, left, update]);
  const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === data.portId) : undefined;
  const headerColor = panel?.type === "device" ? panel.data.headerColor : undefined;
  const label = String(panel?.data.label ?? "Panel");
  const color = signalCssColor(edge?.data?.signalType ?? "custom");
  return <div data-testid="patch-reference" title="Double-click to open Patch Bay"
    onDoubleClick={() => openPatchBay(data.panelNodeId, data.connectionId)}
    className={`relative rounded-lg border bg-white ${selected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-[var(--color-border)]"}`}
    style={{ width: PATCH_REFERENCE_WIDTH, height: PATCH_REFERENCE_HEIGHT }}>
    <div className="px-3 border-b border-[var(--color-border)] rounded-t-lg flex items-center justify-center"
      style={{ height: 31, backgroundColor: headerColor || "var(--color-surface)" }}>
      <span className="text-xs font-semibold text-[var(--color-text-heading)] truncate leading-tight" title={label}
        style={headerColor ? { color: contrastingTextColor(headerColor) } : undefined}>{label}</span>
    </div>
    <div className="grid grid-cols-[1fr_1.5fr_1fr] items-center px-2 gap-1" style={{ height: 31 }}>
      <span className="text-[9px] text-[var(--color-text-muted)] capitalize">{left}</span>
      <span className="text-[10px] font-semibold text-center truncate" title={port?.label || data.portId} style={{ color }}>{port?.label || data.portId}</span>
      <span className="text-[9px] text-[var(--color-text-muted)] capitalize text-right">{right}</span>
    </div>
    {/* Absolute handles use the padding box; compensate the 1px outer border so their centers land on the routing grid. */}
    <Handle type="source" id={left} position={Position.Left} isConnectable={false} className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-px" style={{ top: PATCH_REFERENCE_HANDLE_Y - 1, background: color }} />
    <Handle type="source" id={right} position={Position.Right} isConnectable={false} className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-px" style={{ top: PATCH_REFERENCE_HANDLE_Y - 1, background: color }} />
  </div>;
}
