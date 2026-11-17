# DMX, Art-Net and sACN addressing

Open Device Properties and expand **DMX / Universe** under a DMX, Art-Net or sACN port.

- **Universe source** selects local DMX, Art-Net or sACN on physical DMX ports. Network ports use their signal type.
- **Universe** identifies the logical universe: Art-Net uses 0–32767, sACN uses 1–63999. Local DMX uses a project universe number from 1–63999. Numbers are stored as entered, without automatic offsets.
- **DMX start address**, **Channel footprint** and **Fixture mode** describe the fixture patch. The inclusive end address is calculated; a range beyond channel 512 produces a warning. Footprint is separate from a multicable's channel count.

For a gateway, configure each DMX output's universe separately. For example, its LAN port can have Art-Net IP settings while DMX Out 1 maps to Art-Net universe 0. Configure a fixture's universe, start address and footprint on its DMX input. IP configuration remains independent, under **Network** on addressable Ethernet, Art-Net and sACN ports.

**Reports → DMX / Lighting** lists configured lighting ports, their channel ranges, modes, IP addresses and validation warnings. CSV and PDF exports are available. A physical DMX port's report row includes the IP addresses configured on its device when it has no IP of its own. The Network report also supports Art-Net and sACN ports.

For optional schematic labels, use the **DMX / Universe Patch** auxiliary field (`{{lightingPatch}}`). Port tooltips also include configured lighting addresses.

Universe assignments are explicit per port. They are not propagated through the topology. Modes are free text; footprints are entered manually. Shared addresses are allowed, and overlapping fixture ranges are not automatically treated as errors.
