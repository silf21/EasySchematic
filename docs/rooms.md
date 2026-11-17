# Rooms and nested rooms

Room membership follows the node's midpoint. A smaller room may extend beyond its parent's border as long as its midpoint remains inside. A room can only be nested under a room of greater area; equal-sized overlapping rooms remain peers. If multiple candidates contain the midpoint, the smallest eligible room wins.

The hierarchy is reconciled when rooms are added, moved or resized and when a schematic is loaded. Creating the outer room first or last gives the same hierarchy. Reparenting preserves absolute positions. Devices are assigned to the smallest room containing their midpoint.

Click a room's title to select it; double-click the title to rename it. Selected unlocked rooms show resize handles. The room surface lets clicks pass to inner rooms and devices. A locked outer room does not prevent selecting its inner rooms. Use the title's context menu or the top-right lock button to change a room's lock state.
