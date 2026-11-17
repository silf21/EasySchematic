# DMX, Art-Net and sACN addressing

Open Device Properties and expand **DMX / Universe** under a DMX, Art-Net or sACN port.

- **Universe source** selects local DMX, Art-Net or sACN on physical DMX ports. Network ports use their signal type.
- **Universe** identifies the logical universe: Art-Net uses 0–32767, sACN uses 1–63999. Local DMX uses a project universe number from 1–63999. Numbers are stored as entered, without automatic offsets.
- **DMX start address**, **Channel footprint** and **Fixture mode** describe the fixture patch. The inclusive end address is calculated; a range beyond channel 512 produces a warning. Footprint is separate from a multicable's channel count.

For a gateway, configure each DMX output's universe separately. For example, its LAN port can have Art-Net IP settings while DMX Out 1 maps to Art-Net universe 0. Configure a fixture's universe, start address and footprint on its DMX input. IP configuration remains independent, under **Network** on addressable Ethernet, Art-Net and sACN ports.

**Reports → Virtual Channels / Lighting** lists configured lighting ports, their channel ranges, modes, IP addresses and validation warnings. CSV and PDF exports are available. A physical DMX port's report row includes the IP addresses configured on its device when it has no IP of its own. The Network report also supports Art-Net and sACN ports.

For optional schematic labels, use the **DMX / Universe Patch** auxiliary field (`{{lightingPatch}}`). Port tooltips also include configured lighting addresses.

Universe assignments are explicit per port. They are not propagated through the topology. Modes are free text; footprints are entered manually. Shared addresses are allowed, and overlapping fixture ranges are not automatically treated as errors.

## Virtual channels

Use **Device Properties → Virtual Channels → + Add Virtual Channel** for one logical configuration applied to selected physical ports. Give it a name, select its ports and assign a protocol. All registered protocols are available, including custom signal types. A port may belong to several channels; membership is independent of its visual Section. Virtual channels add no physical connectors or material items.

Configuration follows the selected protocol:

- **DMX, Art-Net, sACN:** start universe, DMX start address, manual footprint and mode. Art-Net uses zero-based universes; sACN and local DMX use one-based universes.
- **SPI output:** pixel count, channels per pixel and pixel mode. Select SPI either as the protocol for a direct SPI channel or as the separate **Output signal**. Selecting Art-Net alone does not expose pixel settings.
- **Any protocol:** optional named protocol parameters. These are recorded as text; protocols without a dedicated editor use these parameters instead of showing lighting-specific fields. IP configuration remains on the physical network port.

For an Art-Net-to-SPI controller, select **Protocol: Art-Net** and **Output signal: SPI**, then assign B1, A1/D1, C1 and GND to Channel 1. Channel 2 can use B2, A2/D2, C2 and the same shared GND. Each channel has independent addressing. The calculated end includes its universe. Select continuous 512-channel packing or whole-pixel packing to match the actual controller (for example 170 RGB pixels / 510 channels per full universe). This is not inferred from the controller model.

The **Virtual Channels / Lighting** report lists each channel once, including protocol, member ports, applicable address range and named parameters; CSV/PDF use the same rows. Individual per-port lighting rows are suppressed only when a lighting virtual channel owns their addressing. The optional `{{virtualChannels}}` auxiliary field and port tooltips show the shared configuration.

Mappings survive schematic save/reload, user-template and project-preset saves, copying, placement and synchronization. Earlier Lighting Channels are automatically upgraded with their original protocol, member ports and pixel settings. Inactive protocol settings are preserved when changing protocol but are not applied or reported. Sections remain a separate visual grouping mechanism.
