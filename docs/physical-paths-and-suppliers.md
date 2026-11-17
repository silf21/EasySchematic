# Physical signal paths, provisioning and suppliers

The development build identifies itself as `0.44.4-dev.1`. About and Copy Debug Info
include the build number and commit hash. The development Docker workflow passes
`github.run_number.github.run_attempt` and the full commit SHA as build arguments.
Local builds display `Build local`. Optional `BUILD_NUMBER` and `BUILD_HASH` environment
variables also work outside Docker.

## Editing a connection

Right-click a connection and choose **Physical path / Supplier…**, or use **Edit**
on its physical-path annotation. The Patch Bay also offers **Cables / supplier…**
on each connection and **Direction / cables…** on occupied patch ports.

- Choose the default supplier and provision for the connection.
- Choose **Rear → Front** or **Front → Rear** for each patch-panel hop. Direction
  is stored per connection/hop, so different signals can traverse a panel differently.
- Every physical section initially represents one cable. Use **Add inline cable /
  adapter cable** to add a real adapter cable, without creating an adapter device
  or an imaginary connecting cable. Rows are in signal order. Give each cable its
  name, length, ends, supplier and optional unit cost.
- For a plug adapter modelled as a device, mark its direct plug attachment as
  **Direct plug attachment (no separate cable)**. That attachment contributes no
  cable to the reports. A whole multi-panel run cannot be a direct attachment.
- Blank supplier/price values inherit from the section or connection. A blank
  explicit supplier can be used to leave a cable unassigned.
- All edits in the dialog are drafts until **Save**. Cancel and Escape discard them.

The compact schematic annotation lists the panels and their positions/directions.
Expand it to see an inline diagram of the physical cables and intermediate panels.
This is a derived annotation on the original logical connection: it does not
create additional devices or edges, or move the existing diagram layout.

Patch Bay labels use the actual port name/position. Existing legacy paired-port
panels remain in the Patch Panel Schedule, as before.

## DMX example

Route the logical DMX connection through PP1 and PP2. Configure:

1. Desk → PP1: `DMX cable`, 10m; then `Adapter 3pin → 5pin`.
2. PP1 → PP2: fixed DMX run, **Fixed installation**.
3. PP2 → fixture: `Adapter 5pin → 3pin`; then `DMX cable`.

Choose each panel's direction to match the physical installation and mark the
panel devices themselves **Fixed installation** if they must not be packed.
The Cable Schedule documents five real cables. The Pack List and By Supplier
report count the four portable cables and exclude the fixed run and panels.

## Reports

- **Cable Schedule** is the full installation schedule, including installed and
  on-site cables, with Supplier and Provision columns. Supplier is a grouping option.
  Click a supplier/provision cell to edit the physical connection.
- **Pack List** counts physical cables, including inline adapter cables, and excludes
  **Fixed installation** and **Provided on site** material. Each device or section/cable
  can be marked independently. Merely using a rear panel port never excludes a cable.
- **By Supplier** provides a project-wide material list with each supplier's quantity,
  cost subtotal and unpriced-item count, plus a grand total. Its CSV and PDF include
  those subtotals. The screen can be filtered and sorted within suppliers by category
  or room/route; CSV/PDF export the complete supplier list.
- **Devices** includes an editable supplier dropdown and exports Supplier to CSV.
- Supplier suggestions are shared across all project devices, connections, sections
  and inline cables. Names are compared without case and redundant whitespace.

A per-cable unit cost takes precedence over a section/connection default price,
then a supplier-specific cable price, then the existing generic cable price.
Materials with different suppliers or unit prices are kept as separate lines.
The supplier report identifies zero-price items as unpriced; its subtotal is the
sum of the entered prices, not a claim that all items have a price.

## File compatibility

Schema 45 adds optional metadata. Earlier files retain Rear → Front direction,
one cable per physical section and inclusion in the pack list unless already
marked venue-provided. Existing generic cable prices remain valid as fallbacks.
Supplier and provisioning are project-instance data, not shared device-template data.

The existing hop-list editing policy still applies: adding/removing panel hops
clears segment overrides because their positional indices change. Configure the
panel route before entering per-section cable details. Flipping the direction of
an existing hop in the physical-path editor preserves the section cable details.
