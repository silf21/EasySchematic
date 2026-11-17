import { useSchematicStore } from "./store";

/** Change selection only: React Flow's displayed edges can be derived patch
 * sections and must never replace canonical connections during capture. */
export function suspendExportSelection(): () => void {
  const { nodes, edges, onNodesChange, onEdgesChange } = useSchematicStore.getState();
  const nodeIds = nodes.filter(n => n.selected).map(n => n.id);
  const edgeIds = edges.filter(e => e.selected).map(e => e.id);
  if (nodeIds.length) onNodesChange(nodeIds.map(id => ({ type: "select", id, selected: false })));
  if (edgeIds.length) onEdgesChange(edgeIds.map(id => ({ type: "select", id, selected: false })));
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    const current = useSchematicStore.getState();
    const liveNodes = new Set(current.nodes.map(n => n.id));
    const liveEdges = new Set(current.edges.map(e => e.id));
    if (nodeIds.length) current.onNodesChange(nodeIds.filter(id => liveNodes.has(id)).map(id => ({ type: "select", id, selected: true })));
    if (edgeIds.length) current.onEdgesChange(edgeIds.filter(id => liveEdges.has(id)).map(id => ({ type: "select", id, selected: true })));
  };
}
