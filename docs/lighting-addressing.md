# DMX, Art-Net and sACN addressing

Open Device Properties and expand **DMX / Universe** under a DMX, Art-Net or sACN port.

- **Universe source** selects local DMX, Art-Net or sACN on physical DMX ports. Network ports use their signal type.
- **Universe** identifies the logical universe: Art-Net uses 0–32767, sACN uses 1–63999. Local DMX uses a project universe number from 1–63999. Numbers are stored as entered, without automatic offsets.
- **DMX start address**, **Channel footprint** and **Fixture mode** describe the fixture patch. The inclusive end address is calculated; a range beyond channel 512 produces a warning. Footprint is separate from a multicable's channel count.

For a gateway, configure each DMX output's universe separately. For example, its LAN port can have Art-Net IP settings while DMX Out 1 maps to Art-Net universe 0. Configure a fixture's universe, start address and footprint on its DMX input. IP configuration remains independent, under **Network** on addressable Ethernet, Art-Net and sACN ports.

**Reports → DMX / Lighting** lists configured lighting ports, their channel ranges, modes, IP addresses and validation warnings. CSV and PDF exports are available. A physical DMX port's report row includes the IP addresses configured on its device when it has no IP of its own. The Network report also supports Art-Net and sACN ports.

For optional schematic labels, use the **DMX / Universe Patch** auxiliary field (`{{lightingPatch}}`). Port tooltips also include configured lighting addresses.

Universe assignments are explicit per port. They are not propagated through the topology. Modes are free text; footprints are entered manually. Shared addresses are allowed, and overlapping fixture ranges are not automatically treated as errors.

## Logical lighting channels and pixel-controller terminals

In Device Properties, use **Lighting Channels → + Add Lighting Channel** for outputs whose configuration applies to several terminals. Select, for example, B1, A1/D1, C1 and GND for Channel 1 and B2, A2/D2, C2 and the same GND for Channel 2. Membership is independent of the port's visual Section. A shared terminal may belong to more than one channel.

Each logical channel has its own source protocol, start universe, DMX start address and mode. Optionally enter pixel count and channels per pixel (3 for RGB, 4 for RGBW); otherwise enter a manual channel footprint. The calculated end includes its universe. Choose **Continuous** for 512-channel addressing or **Whole pixels per universe** to avoid splitting a pixel across universes (for example 170 RGB pixels / 510 channels per full universe). Set this to match the actual controller; it is not inferred from its model. Art-Net universe numbers start at 0 and sACN at 1.

Physical outputs may use the **SPI** signal type. Their terminals remain individually connectable. A grouped port's lighting configuration is edited in its channel; IP settings stay on the network port. The Lighting report lists a group once with its terminals and calculated range, and omits separate per-port lighting rows for its members. CSV/PDF and the optional `{{lightingPatch}}` auxiliary field include logical channels. Port tooltips show their shared mapping.

Mappings are retained by schematic save/reload, user templates, project presets, device copying and template placement. Template synchronization remaps terminal IDs and preserves each existing channel's instance addressing. Deleting a terminal removes it from the saved membership; a group with no remaining ports is flagged for review.
