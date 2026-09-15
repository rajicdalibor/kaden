/**
 * VDOT (Jack Daniels) — deterministički. LLM NE računa ove brojeve.
 * VO2 = -4.60 + 0.182258·v + 0.000104·v²   (v u m/min)
 * %VO2max(t) = 0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)  (t u min)
 * VDOT = VO2 / %VO2max
 */
export function danielsVO2(vMetersPerMin: number): number {
  return -4.60 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin * vMetersPerMin;
}
export function pctVO2max(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

/** VDOT iz rezultata trke (distanca m, vreme s). */
export function vdotFromRace(distanceM: number, timeSec: number): number {
  const t = timeSec / 60;
  const v = distanceM / t;
  return danielsVO2(v) / pctVO2max(t);
}

/** Predviđeno vreme (s) za distancu pri datom VDOT-u (binarna pretraga). */
export function racePredictionSec(vdot: number, distanceM: number): number {
  let lo = 1, hi = 2000; // minuti
  for (let i = 0; i < 80; i++) {
    const t = (lo + hi) / 2;
    const est = danielsVO2(distanceM / t) / pctVO2max(t);
    if (est > vdot) lo = t; else hi = t; // veći VDOT → brže → manje t
  }
  return Math.round(((lo + hi) / 2) * 60);
}

/** Brzina (m/min) na zadatom %VO2max za dati VDOT (inverzija kvadratne). */
export function velocityAtPctVO2max(vdot: number, pct: number): number {
  const target = pct * vdot;
  const a = 0.000104, b = 0.182258, c = -4.60 - target;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
/** Tempo (s/km) na zadatom %VO2max. */
export function paceSecPerKm(vdot: number, pct: number): number {
  return Math.round(60000 / velocityAtPctVO2max(vdot, pct));
}

/** Daniels trening tempi (s/km) iz VDOT-a. */
export function trainingPaces(vdot: number): {
  easy: number; marathon: number; threshold: number; interval: number;
} {
  return {
    easy: paceSecPerKm(vdot, 0.70),
    marathon: paceSecPerKm(vdot, 0.84),
    threshold: paceSecPerKm(vdot, 0.88),
    interval: paceSecPerKm(vdot, 0.975),
  };
}

/** Distanca (m) po tipu trke. */
export function raceDistanceM(race: string): number | null {
  switch (race) {
    case "5k": return 5000;
    case "10k": return 10000;
    case "half_marathon": return 21097.5;
    case "marathon": return 42195;
    default: return null; // ultra/general — nema fiksne
  }
}

export function fmtPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;
}
