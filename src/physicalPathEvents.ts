export function openPhysicalPath(edgeId: string) {
  window.dispatchEvent(new CustomEvent("easyschematic:physical-path", { detail: edgeId }));
}

