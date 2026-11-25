import type { NodeTypes, EdgeTypes } from "@xyflow/react";
import DeviceNodeComponent from "./components/DeviceNode";
import RoomNodeComponent from "./components/RoomNode";
import NoteNodeComponent from "./components/NoteNode";
import AnnotationNodeComponent from "./components/AnnotationNode";
import StubLabelNodeComponent from "./components/StubLabelNode";
import TextStubNodeComponent from "./components/TextStubNode";
import WaypointNodeComponent from "./components/WaypointNode";
import BundleJunctionNodeComponent from "./components/BundleJunctionNode";
import PatchReferenceNode from "./components/PatchReferenceNode";
import PatchReferenceEdge from "./components/PatchReferenceEdge";
import OffsetEdgeComponent from "./components/OffsetEdge";

export const nodeTypes: NodeTypes = {
  "patch-reference": PatchReferenceNode,
  device: DeviceNodeComponent,
  room: RoomNodeComponent,
  note: NoteNodeComponent,
  annotation: AnnotationNodeComponent,
  "stub-label": StubLabelNodeComponent,
  "text-stub": TextStubNodeComponent,
  waypoint: WaypointNodeComponent,
  "bundle-junction": BundleJunctionNodeComponent,
};

export const edgeTypes: EdgeTypes = {
  "patch-reference-edge": PatchReferenceEdge,
  smoothstep: OffsetEdgeComponent,
};
