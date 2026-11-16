import { memo, useMemo, useCallback, useState, useRef } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import type { DeviceNode as DeviceNodeType, Port } from "../types";
import { portSide } from "../types";
import { useSchematicStore } from "../store";
import {
  resolveAuxiliaryLine,
  auxRowHeight,
  rowsInSlot,
  headerBandHeight,
  HEADER_LABEL_ZONE_PX,
  HEADER_LABEL_ZONE_2_PX,
} from "../auxiliaryData";
import type { AuxRow } from "../types";
import { useDisplayLabel } from "../labelCaseUtils";
import { resolveDeviceLabel } from "../displayName";
import { contrastingTextColor } from "../colorContrast";
import { isPortConnected } from "../portVisibility";
import { signalCssColor, signalLabel } from "../typeRegistry";
import { useTypeRegistryVersion } from "../hooks/useTypeRegistryVersion";

type ColumnItem =
  | { type: "port"; port: Port }
  | { type: "section"; name: string }
  | { type: "divider" };

/** Hover-tooltip suffix surfacing a USB-C port's Power Delivery rating, if set. */
function usbcPowerSuffix(port: Port): string {
  const parts: string[] = [];
  if (port.usbcPowerSourceW != null) parts.push(`delivers ${port.usbcPowerSourceW}W`);
  if (port.usbcPowerDrawW != null) parts.push(`draws ${port.usbcPowerDrawW}W`);
  return parts.length ? ` — USB-C PD: ${parts.join(", ")}` : "";
}

/** Build a list of ports interleaved with section headers where section changes. */
function buildColumnItems(ports: Port[]): ColumnItem[] {
  const items: ColumnItem[] = [];
  let lastSection: string | undefined;
  for (const port of ports) {
    if (port.section && port.section !== lastSection) {
      items.push({ type: "section", name: port.section });
    } else if (!port.section && lastSection) {
      // A section just ended into unsectioned ports — emit a closing divider so
      // the following ports don't read as part of the section. (A section
      // followed by ANOTHER section needs nothing; that section's own header is
      // the boundary.)
      items.push({ type: "divider" });
    }
    items.push({ type: "port", port });
    lastSection = port.section;
  }
  return items;
}

function DeviceNodeComponent({ id, data, selected }: NodeProps<DeviceNodeType>) {
  useTypeRegistryVersion(); // community signal labels / colours resolve once registered
  const setEditingNodeId = useSchematicStore((s) => s.setEditingNodeId);
  const flow = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [liveEnds, setLiveEnds] = useState<DeviceNodeType["data"]["adapterCableEnds"] | null>(null);
  const cableDrag = useRef<{ side: "left" | "right"; pointerX: number; pointerY: number; origin: { x: number; y: number } } | null>(null);
  const cableEnds = liveEnds ?? data.adapterCableEnds ?? { left: { x: 0, y: 32 }, right: { x: 208, y: 32 } };
  const onCableEndDown = (e: React.PointerEvent, side: "left" | "right") => {
    e.stopPropagation();
    e.preventDefault();
    cableDrag.current = { side, pointerX: e.clientX, pointerY: e.clientY, origin: { ...cableEnds[side] } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onCableEndMove = (e: React.PointerEvent) => {
    const drag = cableDrag.current;
    if (!drag) return;
    e.stopPropagation();
    const zoom = flow.getZoom();
    const next = { ...cableEnds, [drag.side]: {
      x: drag.origin.x + (e.clientX - drag.pointerX) / zoom,
      y: drag.origin.y + (e.clientY - drag.pointerY) / zoom,
    } };
    setLiveEnds(next);
    updateNodeInternals(id);
  };
  const onCableEndUp = (e: React.PointerEvent) => {
    if (!cableDrag.current) return;
    e.stopPropagation();
    cableDrag.current = null;
    const ends = liveEnds ?? cableEnds;
    const store = useSchematicStore.getState();
    useSchematicStore.setState({ nodes: store.nodes.map(n => n.id === id && n.type === "device"
      ? { ...n, data: { ...n.data, adapterCableEnds: ends } } : n) });
    store.saveToLocalStorage();
    setLiveEnds(null);
    updateNodeInternals(id);
  };

  const displayLabel = useDisplayLabel();
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const wrapDeviceLabels = useSchematicStore((s) => s.wrapDeviceLabels);
  const resolvedLabel = useMemo(
    () => resolveDeviceLabel(data, { useShortNames, wrapDeviceLabels }),
    [data, useShortNames, wrapDeviceLabels],
  );
  const labelZone = resolvedLabel.wrapsInHeader ? HEADER_LABEL_ZONE_2_PX : HEADER_LABEL_ZONE_PX;
  // A custom header color has no idea what the theme's heading/muted tokens will look
  // like on top of it — a black header rendered near-black text and the gray aux rows
  // vanished (#295). Pick black or white off the header's luminance instead. With no
  // custom color the header is `--color-surface` and the theme tokens are already right.
  const headerTextColor = useMemo(
    () => (data.headerColor ? contrastingTextColor(data.headerColor) : null),
    [data.headerColor],
  );
  const hiddenPinSignalTypesStr = useSchematicStore((s) => s.hiddenPinSignalTypes);
  const isHiddenAdapter = useSchematicStore((s) => s.hiddenAdapterNodeIds.has(id));
  const isOverlapping = useSchematicStore((s) => s.overlapNodeId === id);

  const hiddenPinSignalTypes = useMemo(
    () => (hiddenPinSignalTypesStr ? new Set(hiddenPinSignalTypesStr.split(",")) : null),
    [hiddenPinSignalTypesStr],
  );

  const globalHideUnconnectedPorts = useSchematicStore((s) => s.hideUnconnectedPorts);
  // Effective filter = global view toggle OR this device's per-device toggle (#135).
  const hideUnconnectedPorts = globalHideUnconnectedPorts || !!data.showOnlyConnectedPorts;
  const showPortCounts = useSchematicStore((s) => s.showPortCounts);
  const currency = useSchematicStore((s) => s.currency);
  const templateHiddenStr = useSchematicStore((s) => {
    if (!data.templateId) return "";
    const arr = s.templateHiddenSignals[data.templateId];
    return arr ? arr.sort().join(",") : "";
  });

  const connectedHandleStr = useSchematicStore((s) => {
    const ids: string[] = [];
    for (const e of s.edges) {
      if (e.source === id && e.sourceHandle) ids.push(e.sourceHandle);
      if (e.target === id && e.targetHandle) ids.push(e.targetHandle);
    }
    return ids.sort().join(",");
  });
  const connectedHandles = useMemo(
    () => new Set(connectedHandleStr ? connectedHandleStr.split(",") : []),
    [connectedHandleStr],
  );

  // Reactive signal-type map for edges connected to this node — drives passthrough port
  // color/label when the port inherits its signal type from the connected edge. Serialized
  // as "handleId:signalType" pairs so Zustand's shallow equality catches signal-type edits.
  const connectedEdgeSignalsStr = useSchematicStore((s) => {
    const parts: string[] = [];
    for (const e of s.edges) {
      if (!e.data?.signalType) continue;
      if (e.source === id && e.sourceHandle) parts.push(`${e.sourceHandle}:${e.data.signalType}`);
      if (e.target === id && e.targetHandle) parts.push(`${e.targetHandle}:${e.data.signalType}`);
    }
    return parts.sort().join(",");
  });
  const signalByHandle = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    if (!connectedEdgeSignalsStr) return m;
    for (const pair of connectedEdgeSignalsStr.split(",")) {
      const colon = pair.lastIndexOf(":");
      if (colon > 0) m.set(pair.slice(0, colon), pair.slice(colon + 1));
    }
    return m;
  }, [connectedEdgeSignalsStr]);

  const visiblePorts = useMemo(() => {
    if (data.showAllPorts) {
      return hiddenPinSignalTypes
        ? data.ports.filter((p) => !hiddenPinSignalTypes.has(p.signalType))
        : data.ports;
    }

    const tplHidden = templateHiddenStr ? new Set(templateHiddenStr.split(",")) : null;
    const devHiddenPorts = data.hiddenPorts?.length ? new Set(data.hiddenPorts) : null;

    return data.ports.filter((p) => {
      if (hiddenPinSignalTypes?.has(p.signalType)) return false;
      if (tplHidden?.has(p.signalType)) return false;
      if (devHiddenPorts?.has(p.id)) return false;
      if (hideUnconnectedPorts && !isPortConnected(p, connectedHandles)) return false;
      return true;
    });
  }, [data.ports, data.showAllPorts, data.hiddenPorts,
      hiddenPinSignalTypes, templateHiddenStr, hideUnconnectedPorts, connectedHandles]);

  const headerAuxRows = useMemo(
    () => rowsInSlot(data.auxiliaryData, "header"),
    [data.auxiliaryData],
  );
  const footerAuxRows = useMemo(
    () => rowsInSlot(data.auxiliaryData, "footer"),
    [data.auxiliaryData],
  );

  const portCountInfo = useMemo(() => {
    if (!showPortCounts) return null;
    const total = data.ports.length;
    if (total === 0) return null;
    let connected = 0;
    for (const p of data.ports) {
      if (isPortConnected(p, connectedHandles)) connected++;
    }
    return { connected, total };
  }, [showPortCounts, data.ports, connectedHandles]);

  const openPortMenu = useCallback((e: React.MouseEvent, port: Port) => {
    e.preventDefault();
    e.stopPropagation();
    useSchematicStore.setState({
      portContextMenu: { nodeId: id, portId: port.id, screenX: e.clientX, screenY: e.clientY },
    });
  }, [id]);


  // Split ports by visual side (respects flip), not semantic direction.
  // When hideUnconnectedPorts is on, bidir ports with only one side connected
  // collapse into the appropriate column so the device gets smaller.
  // Passthrough ports go into their own list — they render as full-width rows with
  // two handles (rear-left, front-right), similar to bidirectional but spanning both sides.
  const { leftPorts, rightPorts, bidirectional, passthroughPorts, collapsedBidir } = useMemo(() => {
    const collapsedBidir = new Map<string, "in" | "out">();
    const leftPorts: Port[] = [];
    const rightPorts: Port[] = [];
    const bidirectional: Port[] = [];
    const passthroughPorts: Port[] = [];
    for (const p of visiblePorts) {
      if (p.direction === "passthrough") {
        passthroughPorts.push(p);
      } else if (p.direction === "bidirectional") {
        if (hideUnconnectedPorts) {
          const inConn = connectedHandles.has(`${p.id}-in`);
          const outConn = connectedHandles.has(`${p.id}-out`);
          if (inConn && !outConn) {
            (p.flipped ? rightPorts : leftPorts).push(p);
            collapsedBidir.set(p.id, "in");
            continue;
          }
          if (outConn && !inConn) {
            (p.flipped ? leftPorts : rightPorts).push(p);
            collapsedBidir.set(p.id, "out");
            continue;
          }
        }
        bidirectional.push(p);
      } else if (portSide(p) === "left") {
        leftPorts.push(p);
      } else {
        rightPorts.push(p);
      }
    }
    return { leftPorts, rightPorts, bidirectional, passthroughPorts, collapsedBidir };
  }, [visiblePorts, hideUnconnectedPorts, connectedHandles]);

  /** Get handle ID and type for a port in a column, accounting for collapsed bidir ports.
   *  All bidirectional handles use type="source" so React Flow always includes them in
   *  handleBounds.source — its getEdgePosition only searches source bounds for sourceHandle,
   *  even in ConnectionMode.Loose. Our isValidConnection handles real direction checks. */
  const handleProps = (port: Port, _side: "left" | "right") => {
    const connSide = collapsedBidir.get(port.id);
    if (connSide) {
      return connSide === "in"
        ? { handleId: `${port.id}-in`, handleType: "source" as const }
        : { handleId: `${port.id}-out`, handleType: "source" as const };
    }
    return {
      handleId: port.id,
      handleType: (port.direction === "input" ? "target" : "source") as "target" | "source",
    };
  };

  const isPatchPanel = data.deviceType === "patch-panel";

  const leftItems = useMemo(() => {
    const items = buildColumnItems(leftPorts);
    if (isPatchPanel && leftPorts.length > 0) {
      return [{ type: "section" as const, name: "Rear" }, ...items];
    }
    return items;
  }, [leftPorts, isPatchPanel]);
  const rightItems = useMemo(() => {
    const items = buildColumnItems(rightPorts);
    if (isPatchPanel && rightPorts.length > 0) {
      return [{ type: "section" as const, name: "Front" }, ...items];
    }
    return items;
  }, [rightPorts, isPatchPanel]);

  const hasSections = leftItems.some((i) => i.type === "section") ||
    rightItems.some((i) => i.type === "section");

  // Build bidirectional items with section support
  const bidirItems = useMemo(() => buildColumnItems(bidirectional), [bidirectional]);

  // Build passthrough items. On patch panels, prepend Rear/Front column headers in the
  // passthrough row header so the label row shows "Rear ← label → Front".
  const passthroughItems = useMemo(
    () => buildColumnItems(passthroughPorts),
    [passthroughPorts],
  );

  /** A thin closing line marking the end of a section that runs into unsectioned ports. */
  const renderDivider = (key: string) => (
    <div key={key} className="h-1.5 flex items-center px-2" aria-hidden>
      <div className="border-b border-[var(--color-border)]/30 w-full" />
    </div>
  );

  /** Render a port row for a column (left or right). */
  const renderColumnPort = (port: Port, side: "left" | "right") => {
    const h = handleProps(port, side);
    const isLeft = side === "left";
    return (
      <div
        key={port.id}
        className={`flex items-center gap-1 ${isLeft ? "pl-3" : "pr-3 justify-end"} h-4 relative`}
        onContextMenu={(e) => openPortMenu(e, port)}
      >
        {isLeft && (
          <Handle
            type={h.handleType}
            position={Position.Left}
            id={h.handleId}
            data-connected={connectedHandles.has(h.handleId) || undefined}
            data-multi-connect={port.multiConnect || undefined}
            className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-[5px]"
            style={{ background: signalCssColor(port.signalType), top: "50%" }}
          />
        )}
        <span
          className="text-[10px] leading-4 truncate"
          style={{ color: signalCssColor(port.signalType) }}
          title={`${displayLabel(port.label)} (${signalLabel(port.signalType)})${usbcPowerSuffix(port)}`}
        >
          {displayLabel(port.label)}
        </span>
        {!isLeft && (
          <Handle
            type={h.handleType}
            position={Position.Right}
            id={h.handleId}
            data-connected={connectedHandles.has(h.handleId) || undefined}
            data-multi-connect={port.multiConnect || undefined}
            className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-[5px]"
            style={{ background: signalCssColor(port.signalType), top: "50%" }}
          />
        )}
      </div>
    );
  };

  /** Render a passthrough port as a full-width row with rear (left) and front (right) handles. */
  const renderPassthroughPort = (port: Port) => {
    const rearId = `${port.id}-rear`;
    const frontId = `${port.id}-front`;
    const rearConnected = connectedHandles.has(rearId);
    const frontConnected = connectedHandles.has(frontId);
    // For inheriting ports, pick up the connected edge's signal type reactively from
    // signalByHandle (derived from connectedEdgeSignalsStr selector). Prefer rear side;
    // fall back to front, then to the port's stored placeholder.
    const resolvedSignal: string = port.inheritsSignal
      ? (signalByHandle.get(rearId) ?? signalByHandle.get(frontId) ?? port.signalType)
      : port.signalType;
    const passColor = signalCssColor(resolvedSignal);
    const passLabel = signalLabel(resolvedSignal);
    return (
      <div
        key={port.id}
        className="flex justify-between items-center relative h-4"
        onContextMenu={(e) => openPortMenu(e, port)}
      >
        {/* Rear handle — left edge, source (ConnectionMode.Loose; isValidConnection enforces direction) */}
        <Handle
          type="source"
          position={Position.Left}
          id={rearId}
          data-connected={rearConnected || undefined}
          className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-[5px]"
          style={{ background: passColor, top: "50%" }}
        />
        <span
          className="text-[10px] leading-4 truncate px-3 flex-1 text-center"
          style={{ color: passColor }}
          title={`${displayLabel(port.label)} (${passLabel}) — passthrough`}
        >
          ⇔ {displayLabel(port.label)}
        </span>
        {/* Front handle — right edge, source (same reasoning as rear) */}
        <Handle
          type="source"
          position={Position.Right}
          id={frontId}
          data-connected={frontConnected || undefined}
          className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-[5px]"
          style={{ background: passColor, top: "50%" }}
        />
      </div>
    );
  };

  // Each cable endpoint has an independent draggable position. Connection handles
  // follow those positions, while the adapter remains a single device in the BOM.
  if (data.deviceType === "adapter-cable") {
    const left = data.ports.find(p => p.direction === "input" || p.flipped) ?? data.ports[0];
    const right = data.ports.find(p => p !== left && p.direction === "output") ?? data.ports.find(p => p !== left);
    const endpoint = (p: Port | undefined, side: "left" | "right") => {
      if (!p) return null;
      const pt = cableEnds[side];
      const position = side === "left" ? Position.Left : Position.Right;
      const style = { left: pt.x - 6, top: pt.y - 6, right: "auto", transform: "none", width: 12, height: 12,
        background: "var(--color-accent, #ef4444)", border: "2px solid var(--color-border)" } as const;
      return <span key={p.id}>
        <Handle type="target" id={`${p.id}-in`} position={position} style={{ ...style, zIndex: 3 }} />
        <Handle type="source" id={`${p.id}-out`} position={position} style={{ ...style, zIndex: 4 }} />
        <div className="nodrag nopan" onPointerDown={e => onCableEndDown(e, side)} onPointerMove={onCableEndMove}
          onPointerUp={onCableEndUp} onPointerCancel={onCableEndUp}
          title="Drag this grip to move the cable end; drag the circular port below to connect"
          style={{ position: "absolute", left: pt.x - 7, top: pt.y - 27, width: 14, height: 14,
            borderRadius: "50%", border: selected ? "1px dashed #60a5fa" : "1px solid transparent",
            cursor: "move", touchAction: "none", zIndex: 2, pointerEvents: "auto" }} />
        <span style={{ position: "absolute", left: pt.x + (side === "left" ? -8 : 8), top: pt.y + 12,
          transform: side === "left" ? "translateX(-100%)" : "none", fontSize: 10,
          whiteSpace: "nowrap", background: "var(--color-surface)", pointerEvents: "none" }}>{p.label}</span>
      </span>;
    };
    const midX = (cableEnds.left.x + cableEnds.right.x) / 2;
    const midY = (cableEnds.left.y + cableEnds.right.y) / 2;
    return <div onDoubleClick={() => setEditingNodeId(id)}
      style={{ position: "relative", width: 208, height: 64, overflow: "visible", color: "var(--color-text)" }}>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} width={208} height={64}>
        <path d={`M ${cableEnds.left.x} ${cableEnds.left.y} L ${cableEnds.right.x} ${cableEnds.right.y}`}
          fill="none" stroke="var(--color-accent, #ef4444)" strokeWidth={3} />
      </svg>
      <div style={{ position: "absolute", left: midX, top: midY - 30, transform: "translate(-50%, -50%)",
        padding: "3px 7px", border: selected ? "1px solid #60a5fa" : "1px solid var(--color-border)",
        borderRadius: 4, background: "var(--color-surface)", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {displayLabel(data.label)}{data.adapterCableLength ? ` · ${data.adapterCableLength}` : ""}
      </div>
      {endpoint(left, "left")}{endpoint(right, "right")}
    </div>;
  }

  if (isHiddenAdapter) {
    // Render 1x1 invisible placeholder — keeps React Flow handle refs valid but
    // doesn't block device placement (RF re-measures this as ~1px)
    return (
      <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        {data.ports.map((p) => {
          if (p.direction === "bidirectional") {
            return (
              <span key={p.id}>
                <Handle type="target" position={Position.Left} id={`${p.id}-in`} style={{ opacity: 0 }} />
                <Handle type="source" position={Position.Right} id={`${p.id}-out`} style={{ opacity: 0 }} />
              </span>
            );
          }
          if (p.direction === "passthrough") {
            return (
              <span key={p.id}>
                <Handle type="source" position={Position.Left} id={`${p.id}-rear`} style={{ opacity: 0 }} />
                <Handle type="source" position={Position.Right} id={`${p.id}-front`} style={{ opacity: 0 }} />
              </span>
            );
          }
          const side = portSide(p);
          return (
            <Handle
              key={p.id}
              type={p.direction === "input" ? "target" : "source"}
              position={side === "left" ? Position.Left : Position.Right}
              id={p.id}
              style={{ opacity: 0 }}
            />
          );
        })}
      </div>
    );
  }

  /** Footer aux block — rows below the port area. Grid-rounded (16-multiple) so device
   *  bottom stays on the snap grid. Blank rows render as 6-px separator gaps. */
  function renderFooterAuxBlock(rows: AuxRow[]) {
    if (rows.length === 0) return null;
    const raw = 1 + rows.reduce((sum, r) => sum + auxRowHeight(r), 0);
    const totalPad = Math.ceil(raw / 16) * 16 - raw;
    const pt = Math.floor(totalPad / 2);
    const pb = totalPad - pt;
    return (
      <div
        className="auxiliaryData px-3 border-t border-[var(--color-border)]"
        style={{ paddingTop: pt, paddingBottom: pb }}
      >
        {rows.map((row, i) => renderAuxRow(row, i))}
      </div>
    );
  }

  /** Individual aux row markup shared between header band and footer block.
   *  `color` overrides the muted token for header rows sitting on a custom header
   *  color; the slight fade keeps them secondary to the device name (#295). */
  function renderAuxRow(row: AuxRow, key: number, color?: string | null) {
    if (!row.text.trim()) {
      return <div key={key} aria-hidden style={{ height: 6 }} />;
    }
    const resolved = displayLabel(resolveAuxiliaryLine(row.text, data, { connectedCount: portCountInfo?.connected, currency }));
    return (
      <div
        key={key}
        className="text-[9px] text-[var(--color-text-muted)] leading-3 truncate whitespace-nowrap text-center"
        style={color ? { color, opacity: 0.85 } : undefined}
        title={resolved}
      >
        {resolved}
      </div>
    );
  }

  /** Header band — label zone + header aux rows, centered together in a 16-multiple band.
   *  Replaces the old separate name strip + header aux block: eliminates the ~14-px
   *  wasted whitespace between the label and the first aux row.
   *
   *  Keep the band-height formula in sync with `headerBandHeight()` in auxiliaryData.ts —
   *  snapUtils uses it to estimate device height before React Flow measures it. */
  function renderHeaderBand(rows: AuxRow[]) {
    const bandH = headerBandHeight(data.auxiliaryData, labelZone);
    const content = labelZone + rows.reduce((sum, r) => sum + auxRowHeight(r), 0);
    const totalPad = bandH - content;
    const pt = Math.floor(totalPad / 2);
    const pb = totalPad - pt;
    const labelStyle: React.CSSProperties = {
      ...(resolvedLabel.wrapsInHeader
        ? {
            display: "-webkit-box" as const,
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden" as const,
            wordBreak: "break-word" as const,
            textAlign: "center" as const,
            lineHeight: "14px",
          }
        : {}),
      ...(headerTextColor ? { color: headerTextColor } : {}),
    };
    return (
      <div
        className="px-3 border-b border-[var(--color-border)] rounded-t-lg flex flex-col"
        style={{
          backgroundColor: data.headerColor || "var(--color-surface)",
          paddingTop: pt,
          paddingBottom: pb,
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{ height: labelZone }}
        >
          <span
            className={
              resolvedLabel.wrapsInHeader
                ? "text-xs font-semibold text-[var(--color-text-heading)]"
                : "text-xs font-semibold text-[var(--color-text-heading)] truncate leading-tight"
            }
            style={labelStyle}
            title={displayLabel(resolvedLabel.text)}
          >
            {displayLabel(resolvedLabel.text)}
          </span>
        </div>
        {rows.map((row, i) => renderAuxRow(row, i, headerTextColor))}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => setEditingNodeId(id)}
      className={`
        relative rounded-lg border bg-white
        ${isOverlapping ? "border-red-400 shadow-lg shadow-red-400/30" : selected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-[var(--color-border)]"}
      `}
      style={{ width: 144 }}
    >
      {/* Header band — merged name strip + header aux rows. Height is always a 16-multiple
           (min 32) so the first port below stays on the pathfinding grid. */}
      {renderHeaderBand(headerAuxRows)}

      {/* Port area — 6px top padding lands handle centers on the 16px grid:
           1px (outer top border) + headerBand(16-mult) + 1px (header border-b)
           + 6px (pt) + 8px (half row) ≡ 0 mod 16.
           The header's `border-b` adds 1px between the band and the port column,
           which the `pt` value (6 not 7) compensates for. */}
      <div className="pt-[6px] pb-[7px]">
      {/* Input/Output Ports — two independent columns */}
      {(leftPorts.length > 0 || rightPorts.length > 0) && (
        hasSections ? (
          /* Sectioned layout: independent columns */
          <div className="flex">
            {/* Left column */}
            <div className="flex-1 min-w-0">
              {leftItems.map((item, i) =>
                item.type === "section" ? (
                  <div key={`lsec-${i}`} className="h-4 flex items-end pl-2">
                    <span className="text-[9px] text-[var(--color-text-muted)] truncate border-b border-[var(--color-border)]/30 w-full pb-0.5 mr-1">
                      {displayLabel(item.name)}
                    </span>
                  </div>
                ) : item.type === "divider" ? (
                  renderDivider(`ldiv-${i}`)
                ) : renderColumnPort(item.port, "left"),
              )}
            </div>

            {/* Right column */}
            <div className="flex-1 min-w-0">
              {rightItems.map((item, i) =>
                item.type === "section" ? (
                  <div key={`rsec-${i}`} className="h-4 flex items-end pr-2">
                    <span className="text-[9px] text-[var(--color-text-muted)] truncate text-right border-b border-[var(--color-border)]/30 w-full pb-0.5 ml-1">
                      {displayLabel(item.name)}
                    </span>
                  </div>
                ) : item.type === "divider" ? (
                  renderDivider(`rdiv-${i}`)
                ) : renderColumnPort(item.port, "right"),
              )}
            </div>
          </div>
        ) : (
          /* Non-sectioned layout: paired rows */
          <div>
            {Array.from({ length: Math.max(leftPorts.length, rightPorts.length, 1) }, (_, i) => {
              const left = leftPorts[i];
              const right = rightPorts[i];
              const lh = left ? handleProps(left, "left") : null;
              const rh = right ? handleProps(right, "right") : null;
              return (
                <div key={i} className="flex justify-between items-center relative h-4">
                  <div className="flex items-center gap-1 pl-3 min-w-0 flex-1" onContextMenu={left ? (e) => openPortMenu(e, left) : undefined}>
                    {left && lh && (
                      <>
                        <Handle
                          type={lh.handleType}
                          position={Position.Left}
                          id={lh.handleId}
                          data-connected={connectedHandles.has(lh.handleId) || undefined}
                          data-multi-connect={left.multiConnect || undefined}
                          className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-[5px]"
                          style={{ background: signalCssColor(left.signalType), top: "50%" }}
                        />
                        <span
                          className="text-[10px] leading-4 truncate"
                          style={{ color: signalCssColor(left.signalType) }}
                          title={`${displayLabel(left.label)} (${signalLabel(left.signalType)})${usbcPowerSuffix(left)}`}
                        >
                          {displayLabel(left.label)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 pr-3 min-w-0 flex-1 justify-end" onContextMenu={right ? (e) => openPortMenu(e, right) : undefined}>
                    {right && rh && (
                      <>
                        <span
                          className="text-[10px] leading-4 truncate"
                          style={{ color: signalCssColor(right.signalType) }}
                          title={`${displayLabel(right.label)} (${signalLabel(right.signalType)})${usbcPowerSuffix(right)}`}
                        >
                          {displayLabel(right.label)}
                        </span>
                        <Handle
                          type={rh.handleType}
                          position={Position.Right}
                          id={rh.handleId}
                          data-connected={connectedHandles.has(rh.handleId) || undefined}
                          data-multi-connect={right.multiConnect || undefined}
                          className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-[5px]"
                          style={{ background: signalCssColor(right.signalType), top: "50%" }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Empty Expansion Slots — hidden when slot.hideWhenEmpty (template, storage media
          etc.) or slot.hidden (per-instance user toggle, #211). */}
      {data.slots?.some((s) => !s.cardTemplateId && !s.hideWhenEmpty && !s.hidden) && (
        <div>
          {data.slots.filter((s) => !s.cardTemplateId && !s.hideWhenEmpty && !s.hidden).map((slot) => (
            <div key={slot.slotId} className="flex justify-center items-center h-4 mx-1">
              <span className="text-[9px] text-[var(--color-text-muted)] opacity-40 truncate text-center italic">
                {displayLabel(slot.label)} (empty)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Passthrough Ports — one row per circuit, rear handle left, front handle right */}
      {passthroughPorts.length > 0 && (
        <div>
          <div className="flex h-4">
            <div className="flex-1 flex items-end pl-2">
              <span className="text-[9px] text-[var(--color-text-muted)] truncate border-b border-[var(--color-border)]/30 w-full pb-0.5 mr-1">
                {displayLabel("Rear")}
              </span>
            </div>
            <div className="flex-1 flex items-end pr-2 justify-end">
              <span className="text-[9px] text-[var(--color-text-muted)] truncate text-right border-b border-[var(--color-border)]/30 w-full pb-0.5 ml-1">
                {displayLabel("Front")}
              </span>
            </div>
          </div>
          {passthroughItems.map((item, i) =>
            item.type === "section" ? (
              <div key={`psec-${i}`} className="flex justify-center items-end h-4 mx-1">
                <span className="text-[9px] text-[var(--color-text-muted)] pb-0.5 truncate border-b border-[var(--color-border)]/30 w-full text-center">
                  {displayLabel(item.name)}
                </span>
              </div>
            ) : item.type === "divider" ? (
              renderDivider(`pdiv-${i}`)
            ) : renderPassthroughPort(item.port),
          )}
        </div>
      )}

      {/* Bidirectional Ports */}
      {bidirectional.length > 0 && (
        <div>
          {bidirItems.map((item, i) => {
            if (item.type === "section") {
              return (
                <div key={`bsec-${i}`} className="flex justify-center items-end h-4 mx-1">
                  <span className="text-[9px] text-[var(--color-text-muted)] pb-0.5 truncate border-b border-[var(--color-border)]/30 w-full text-center">
                    {displayLabel(item.name)}
                  </span>
                </div>
              );
            }
            if (item.type === "divider") {
              return renderDivider(`bdiv-${i}`);
            }

            const port = item.port;
            const inId = `${port.id}-in`;
            const outId = `${port.id}-out`;
            const inConnected = connectedHandles.has(inId);
            const outConnected = connectedHandles.has(outId);
            const inDisabled = outConnected;
            const outDisabled = inConnected;

            return (
              <div key={port.id} className="flex justify-center items-center relative h-4">
                <Handle
                  type="source"
                  position={Position.Left}
                  id={inId}
                  data-connected={connectedHandles.has(inId) || undefined}
                  data-multi-connect={port.multiConnect || undefined}
                  className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-left-[5px]"
                  style={{
                    background: inDisabled ? "#d1d5db" : signalCssColor(port.signalType),
                    opacity: inDisabled ? 0.4 : 1,
                    top: "50%",
                  }}
                />
                <span
                  className="text-[10px] leading-4 truncate"
                  style={{ color: signalCssColor(port.signalType) }}
                  title={`${displayLabel(port.label)} (${signalLabel(port.signalType)}) — bidirectional${usbcPowerSuffix(port)}`}
                >
                  ↔ {displayLabel(port.label)}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={outId}
                  data-connected={connectedHandles.has(outId) || undefined}
                  data-multi-connect={port.multiConnect || undefined}
                  className="!w-2.5 !h-2.5 !border-2 !border-[var(--color-border)] !-right-[5px]"
                  style={{
                    background: outDisabled ? "#d1d5db" : signalCssColor(port.signalType),
                    opacity: outDisabled ? 0.4 : 1,
                    top: "50%",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      {portCountInfo && (
        <div className="text-center h-4 flex items-center justify-center">
          <span className="text-[9px] text-[var(--color-text-muted)]">
            {portCountInfo.connected} / {portCountInfo.total} IOs connected
          </span>
        </div>
      )}
      {renderFooterAuxBlock(footerAuxRows)}
      </div>
    </div>
  );
}

export default memo(DeviceNodeComponent);
