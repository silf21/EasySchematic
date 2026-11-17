/** Halfway along the routed wire, rather than halfway across its bounding box. */
export function patchLabelPosition(points: readonly { x: number; y: number }[] | undefined, fallback: { x: number; y: number }) {
  if (!points?.length) return fallback;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (!lengths[i]) continue;
    if (remaining <= lengths[i]) {
      const t = remaining / lengths[i];
      return { x: points[i].x + t * (points[i + 1].x - points[i].x), y: points[i].y + t * (points[i + 1].y - points[i].y) };
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}
