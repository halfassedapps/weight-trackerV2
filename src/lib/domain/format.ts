// Ported from V1 (index.html:1529-1536) — a small shared SVG path helper
// used by all three nutrition charts' bars.

/** A bar path from `yBaseline` to `yEnd`, rounded on whichever end is away from the baseline. */
export function roundedBarPath(x: number, w: number, yBaseline: number, yEnd: number, r: number): string {
  const up = yEnd < yBaseline;
  const rr = Math.max(0, Math.min(r, w / 2, Math.abs(yBaseline - yEnd)));
  if (rr === 0) return `M${x},${yBaseline} H${x + w} V${yEnd} H${x} Z`;
  return up
    ? `M${x},${yBaseline} V${yEnd + rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd + rr} V${yBaseline} Z`
    : `M${x},${yBaseline} V${yEnd - rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd - rr} V${yBaseline} Z`;
}
