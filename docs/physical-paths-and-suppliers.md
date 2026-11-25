# Virtual patching, distributed panel references and suppliers

The development version and About dialog retain build number / commit identification.
The development Docker workflow passes these values to the image build.

## Physical faces in Patch Bay

Each virtual panel hop specifies the physical face toward the preceding station in the
connection's stored order. The opposite face faces the next station. This is a physical
connection mapping, independent of whether the carried signal is bidirectional.

Choose the face while assigning a port, or use the **Previous: Front · Next: Rear ⇄**
button directly below an occupied port in Patch Bay to swap the mapping. An MA3 console
can connect to PP1 Front, continue from PP1 Rear to PP2 Rear, and leave PP2 Front toward
the remote device. Connector checks, face labels and reports use this same mapping.
Changing the face preserves section lengths, suppliers and cable labels.

## Distributed references in the schematic

Virtual patch assignments now show local, independently movable panel-position
references. Every reference names the real panel and used position (for example DMX1)
and exposes its Front and Rear faces. Compact references use the same 144px width
and header / port-row styling as devices. Double-click a reference or a real patch
panel device to open Patch Bay at the corresponding panel. The lines actually terminate at these handles;
the usual automatic or simple router routes each displayed section.

The same real panel can appear at multiple places along different circuits. These
are references to the centrally managed panel/port, not extra device instances or
additional material. Names and face mappings remain synchronized with Patch Bay.

Use **Compact schematic** on a connection in Patch Bay, or **Hide panel references**
in its schematic context menu, to restore the single logical line. Reference positions
are retained when switching views and saved with the project. Removing a selected
reference also returns that connection to compact view without removing the panel or
its patch assignment. Deleting a real panel or removing a patch assignment removes
its references. Copying a connection still starts unpatched to avoid double-booking
physical ports. In the expanded view move the references to adjust the path; canonical
path handles remain available in compact view.

![Distributed patch references](/distributed-patch-references.png)

Cable IDs and cable lengths on the displayed sections follow the controls under
**View → Connections → Show cable IDs / Show cable lengths**, independently.

## Actual adapters and cables

The separate Physical signal path popup, inline-cable editor and floating tile chain
have been removed. This revision keeps the original cable / adapter-device model.
A dedicated adapter-cable category and general cable-to-cable chaining are not part
of this change.

Existing adapter devices can use **Direkt gesteckt – kein zusätzliches Kabel** on
the relevant port. A direct plug connection is a thin gray line with no additional
cable ID or cable material count. Real cables remain connections in the schematic.
Virtual patching retains the original section-per-panel-gap model. If an outer adapter
port is marked direct-attach, that outer section is a plug attachment, not an extra
cable. A real cable between two panels is still counted independently.

## Supplier and Festinstalliert

Supplier is available on devices, connections and virtual physical sections. Shared
suggestions include the reserved value **Festinstalliert**, even in an empty project.
For a section, a blank explicit supplier leaves it unassigned; an absent section
supplier inherits the connection's supplier.

- Supplier **Festinstalliert**: visible in the schematic and the complete Cable
  Schedule, excluded from the Pack List / By Supplier material lists and their totals.
- Any other or empty supplier: included in the material lists. An empty value means
  the supplier has not yet been assigned.

Comparison ignores case and redundant whitespace. Use the default connection supplier
in Patch Bay or the connection context menu; use the face's supplier input in Patch Bay
or the Supplier cell in Cable Schedule for a section override. A fixed section is drawn
with a dashed line when panel references are shown. Panel devices themselves can also
have supplier Festinstalliert.

There is no separate provisioning selector or status tile. No supplier-data migration
is performed. Older experimental provisioning / inline-cable metadata is not interpreted
by the new workflow. Existing pre-feature venue-provided devices keep their original
Pack List exclusion behavior.

## Reports and compatibility

The Cable Schedule documents all physical sections. Pack List and **By Supplier** use
those same sections while excluding Festinstalliert. The supplier report retains
quantities, supplier subtotals, grand total, unpriced counts and CSV/PDF export. Materials
with different suppliers or prices remain separate; supplier-specific cable prices
fall back to the existing generic price entries. Supplier/provisioning migration is
intentionally omitted; schema 46 adds only the distributed-reference representation.

As in the original virtual patch model, adding/removing panel hops clears positional
section overrides. Set the route first, then enter section labels, lengths and suppliers.
Flipping the physical face does not clear those overrides.

## Stubbing an individual patch section

In the distributed schematic view, right-click the cable section to split and choose **Stub Connection**. Only that section is replaced with two endpoint-attached labels naming its opposite device or panel, panel position and used Front/Rear face. The labels follow their endpoint devices. Other sections remain visible; physical patch assignments, supplier information, quantities and costs are unchanged.

Right-click either short leg or label and choose **Show Full Connection** to restore that section. Section stubs survive save/reload and support undo/redo. Changing the patch-hop sequence resets section overrides, including stubs, so an index never points at a different physical section. In compact view the complete circuit remains visible; the per-section presentation is retained for the distributed view.

Distributed panel references use the real panel's name-display settings (short name, per-device/global wrapping and display case), header color and configured header/footer Auxiliary Data. Edit these on the real panel; every reference updates with it. References still show only their assigned position and physical faces. Extra text expands the reference in 16px steps, keeping its port centers on the routing grid. The PDF/image and DXF exports use the same panel data.

Cable ID and length labels on routed patch sections are anchored halfway along the actual routed wire, including bent Ethernet runs. Right-click a displayed section and choose **Set Cable Length…** to edit that section's length. Other section lengths and the compact connection's stored length are preserved. The global cable-ID and cable-length visibility controls remain independent.

Generated panel references have a subtle neutral background and a dashed outline to distinguish them from actual devices. Their text and ports remain fully opaque, selected references retain the blue selection border, and explicit real-panel header colors are preserved.

## Properties of individual physical cable sections

Right-click the required section in the distributed schematic. **Patch section A/B/…** identifies its endpoints and exposes its cable ID, length, Supplier and unit cost. Each field updates only that section. Unspecified suppliers/prices inherit the compact connection's defaults; a section can have a different supplier and price, or be marked Festinstalliert. Quantities, cable schedule and supplier totals use the section values. Direct plug attachments are identified as such and do not expose properties for a nonexistent cable.

The older **Venue provided** device checkbox also excludes that device from the pack list, but is a separate legacy flag. It does not assign a Supplier and does not mark the device's attached cables as installed. Use **Supplier = Festinstalliert** to describe fixed devices and each relevant fixed cable section consistently.

## Origin devices in the patch list

In **Reports → Patch Panels → Columns**, select **Origin Device / Origin Port** for legacy single-face panels or **Rear Origin Device / Rear Origin Port** and **Front Origin Device / Front Origin Port** for passthrough panels.

Remote Device/Port still describes the immediately connected neighbor. Origin Device/Port follows the passive path to its actual endpoint: for example Remote Device `DMX5p M → 3p` can have Origin Device `grandMA3 onPC` and Origin Port `DMX OUT A`. Adapter visibility does not affect the result. Virtual multi-panel assignments, explicit passthrough panels and paired stub legs are supported. Each face is resolved independently; Origin does not imply signal direction.

Only unambiguous two-port adapters and unnormalled panel passthroughs are traversed. Active devices such as switches are endpoints. Open paths, loops and ambiguous/multi-port adapter mappings are marked **Unresolved** instead of guessing an endpoint. Direct attachments can show origins without becoming material cables.

The new fields participate in filtering and sorting. The PDF follows the visible columns; CSV appends the six origin columns after the existing 34 columns, preserving their original positions.
