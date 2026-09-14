/** 5-zone model po % HRmax. Granice: 50/60/70/80/90/100. */
export const ZONE_BOUNDS: [number, number][] = [
  [0.50, 0.60], [0.60, 0.70], [0.70, 0.80], [0.80, 0.90], [0.90, 1.01],
];

export function zoneOf(hr: number, hrMax: number): number {
  const frac = hr / hrMax;
  for (let i = 0; i < ZONE_BOUNDS.length; i++) {
    const [lo, hi] = ZONE_BOUNDS[i];
    if (frac >= lo && frac < hi) return i;
  }
  return frac < 0.50 ? 0 : 4;
}
