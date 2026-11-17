import type { DeviceData } from "./types";
import { resolveDeviceLabel, type SchematicDisplayDefaults } from "./displayName";
import { auxBlockHeight, auxRowHeight, headerBandHeight, HEADER_LABEL_ZONE_2_PX, HEADER_LABEL_ZONE_PX, rowsInSlot } from "./auxiliaryData";

/** Share the real panel's label and auxiliary-row rules while showing one port only. */
export function patchReferenceDisplay(panel: DeviceData, defaults: SchematicDisplayDefaults = {}) {
  const label = resolveDeviceLabel(panel, defaults);
  const labelZone = label.wrapsInHeader ? HEADER_LABEL_ZONE_2_PX : HEADER_LABEL_ZONE_PX;
  const headerRows = rowsInSlot(panel.auxiliaryData, "header");
  const footerRows = rowsInSlot(panel.auxiliaryData, "footer");
  const headerHeight = headerBandHeight(panel.auxiliaryData, labelZone);
  const footerHeight = auxBlockHeight(panel.auxiliaryData);
  const contentHeight = labelZone + headerRows.reduce((sum, row) => sum + auxRowHeight(row), 0);
  return { label, labelZone, headerRows, footerRows, headerHeight, footerHeight,
    headerPadding: headerHeight - contentHeight,
    handleY: headerHeight + 16, height: headerHeight + 32 + footerHeight };
}
