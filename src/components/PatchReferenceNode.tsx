import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";
import { useSchematicStore } from "../store";
import type { AuxRow, DeviceData, PatchReferenceNode as ReferenceNode } from "../types";
import { entryFace, exitFace } from "../patchCircuits";
import { signalCssColor } from "../typeRegistry";
import { contrastingTextColor } from "../colorContrast";
import { PATCH_REFERENCE_WIDTH } from "../patchReferences";
import { patchReferenceDisplay } from "../patchReferenceDisplay";
import { auxRowHeight, resolveAuxiliaryLine } from "../auxiliaryData";
import { useDisplayLabel } from "../labelCaseUtils";
import { isPortConnected } from "../portVisibility";
import { openPatchBay } from "../patchBayNavigation";

export default function PatchReferenceNode({ id, data, selected }: NodeProps<ReferenceNode>) {
  const panel = useSchematicStore(s => s.nodes.find(n => n.id === data.panelNodeId));
  const edge = useSchematicStore(s => s.edges.find(e => e.id === data.connectionId));
  const useShortNames = useSchematicStore(s => s.useShortNames);
  const wrapDeviceLabels = useSchematicStore(s => s.wrapDeviceLabels);
  const currency = useSchematicStore(s => s.currency);
  const connectedCount = useSchematicStore(s => {
    if (!s.showPortCounts || panel?.type !== "device" || !panel.data.ports.length) return undefined;
    const handles = new Set<string>();
    for (const edge of s.edges) {
      if (edge.source === data.panelNodeId && edge.sourceHandle) handles.add(edge.sourceHandle);
      if (edge.target === data.panelNodeId && edge.targetHandle) handles.add(edge.targetHandle);
    }
    return panel.data.ports.filter(port => isPortConnected(port, handles)).length;
  });
  const displayLabel = useDisplayLabel();
  const panelData: DeviceData = panel?.type === "device" ? panel.data : { label: "Panel", deviceType: "patch-panel", ports: [] };
  const layout = patchReferenceDisplay(panelData, { useShortNames, wrapDeviceLabels });
  const update = useUpdateNodeInternals();
  const hop = edge?.data?.patchHops?.find(h => h.panelNodeId === data.panelNodeId && h.portId === data.portId);
  const left = hop ? entryFace(hop) : "rear";
  const right = hop ? exitFace(hop) : "front";
  useEffect(() => { update(id); }, [id, left, layout.handleY, layout.height, update]);
  const port = panel?.type === "device" ? panel.data.ports.find(p => p.id === data.portId) : undefined;
  const headerColor = panel?.type === "device" ? panel.data.headerColor : undefined;
  const label = displayLabel(layout.label.text);
  const headerTextColor = headerColor ? contrastingTextColor(headerColor) : undefined;
  const renderAux = (row: AuxRow, i: number, header = false) => {
    if (!row.text.trim()) return <div key={i} aria-hidden style={{ height: auxRowHeight(row) }} />;
    const text = displayLabel(resolveAuxiliaryLine(row.text, panelData, { currency, connectedCount }));
    return <div key={i} className="text-[9px] text-[var(--color-text-muted)] leading-3 truncate whitespace-nowrap text-center" title={text} style={header && headerTextColor ? { color: headerTextColor, opacity: 0.85 } : undefined}>{text}</div>;
  };
  const footerContent = 1 + layout.footerRows.reduce((sum, row) => sum + auxRowHeight(row), 0);
  const footerPadding = layout.footerHeight - footerContent;
  const color = signalCssColor(edge?.data?.signalType ?? "custom");
  return <div data-testid="patch-reference" title="Double-click to open Patch Bay"
    onDoubleClick={() => openPatchBay(data.panelNodeId, data.connectionId)}
    className={`relative rounded-lg border bg-white ${selected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-[var(--color-border)]"}`}
    style={{ width: PATCH_REFERENCE_WIDTH, height: layout.height }}>
    <div className="px-3 border-b border-[var(--color-border)] rounded-t-lg flex flex-col justify-center"
      style={{ height: layout.headerHeight - 1, paddingTop: Math.floor(layout.headerPadding / 2), paddingBottom: Math.max(0, Math.ceil(layout.headerPadding / 2) - 1), backgroundColor: headerColor || "var(--color-surface)" }}>
      <div className="flex items-center justify-center shrink-0" style={{ height: layout.labelZone }}>
        <span className={`text-xs font-semibold text-[var(--color-text-heading)] ${layout.label.wrapsInHeader ? "" : "truncate leading-tight"}`} title={label}
          style={{ color: headerTextColor, ...(layout.label.wrapsInHeader ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", textAlign: "center", lineHeight: "14px" } : {}) }}>{label}</span>
      </div>
      {layout.headerRows.map((row, i) => renderAux(row, i, true))}
    </div>
    <div className="grid grid-cols-[1fr_1.5fr_1fr] items-center px-2 gap-1" style={{ height: 31 }}>
      <span className="text-[9px] text-[var(--color-text-muted)] capitalize">{left}</span>
      <span className="text-[10px] font-semibold text-center truncate" title={port?.label || data.portId} style={{ color }}>{displayLabel(port?.label || data.portId)}</span>
      <span className="text-[9px] text-[var(--color-text-muted)] capitalize text-right">{right}</span>
    </div>
    {layout.footerRows.length > 0 && <div className="auxiliaryData px-3 border-t border-[var(--color-border)]" style={{ paddingTop: Math.floor(footerPadding / 2), paddingBottom: Math.ceil(footerPadding / 2) }}>{layout.footerRows.map((row, i) => renderAux(row, i))}</div>}
    {/* Absolute handles use the padding box; compensate the 1px outer border so their centers land on the routing grid. */}
    <Handle type="source" id={left} position={Position.Left} isConnectable={false} className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-px" style={{ top: layout.handleY - 1, background: color }} />
    <Handle type="source" id={right} position={Position.Right} isConnectable={false} className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-px" style={{ top: layout.handleY - 1, background: color }} />
  </div>;
}
