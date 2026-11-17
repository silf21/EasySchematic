import { useSchematicStore } from "./store";

let pendingPanel: string | null = null;

/** Open the shared Patch Bay, retaining the real panel identity behind a local reference. */
export function openPatchBay(panelNodeId: string, connectionId?: string): void {
  const store = useSchematicStore.getState();
  pendingPanel = panelNodeId;
  const pageId = store.addPatchPanelPage();
  store.setActivePage(pageId);
  store.setPatchAssignEdge(null);
  store.setPatchTracedEdge(connectionId ?? null);
}

export function takePatchBayFocus(): string | null {
  const panel = pendingPanel;
  pendingPanel = null;
  return panel;
}
