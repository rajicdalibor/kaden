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

/**
 * LTHR-bazirane zone (Garmin, po laktatnom pragu). Granice kao udeo LTHR-a,
 * kalibrisane na Daliborove zone sa sata: za LTHR=169 → Z1<114, Z2<133, Z3<152,
 * Z4<169, Z5≥169. Vraća indeks 0..4 (Z1..Z5).
 */
export const LTHR_ZONE_BOUNDS = [0.675, 0.787, 0.899, 1.0];
export function zoneOfLthr(hr: number, lthr: number): number {
  const f = hr / lthr;
  for (let i = 0; i < LTHR_ZONE_BOUNDS.length; i++) {
    if (f < LTHR_ZONE_BOUNDS[i]) return i;
  }
  return 4;
}
