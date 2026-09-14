import type { RawSession, SessionMetrics, AthleteProfile } from "@kaden/shared-types";
import { zoneOf } from "./zones.js";
import { trimpBanister } from "./trimp.js";
import { aerobicDecoupling } from "./decoupling.js";
export * from "./zones.js";
export * from "./trimp.js";
export * from "./decoupling.js";
export * from "./load.js";

/** Glavni ulaz: sirova sesija + profil -> per-session metrike. Deterministički, bez LLM-a. */
export function computeSessionMetrics(
  s: RawSession,
  p: Pick<AthleteProfile, "hrMax" | "hrRest" | "sex">,
): SessionMetrics {
  const zoneSecs = [0, 0, 0, 0, 0];
  const trimpSamples: { hr: number | null; dtMin: number }[] = [];
  const efPairs: { spd: number; hr: number }[] = [];
  let prev: number | null = null;

  for (const r of s.hrStream) {
    const t = Date.parse(r.t) / 1000;
    let dt = prev == null ? 1 : t - prev;
    if (dt <= 0 || dt > 10) dt = 1;
    prev = t;
    if (r.hr != null) {
      zoneSecs[zoneOf(r.hr, p.hrMax)] += dt;
      trimpSamples.push({ hr: r.hr, dtMin: dt / 60 });
      if (r.spd > 0.5) efPairs.push({ spd: r.spd, hr: r.hr });
    }
  }
  const totalZ = zoneSecs.reduce((a, b) => a + b, 0) || 1;
  return {
    sessionId: s.sessionId,
    date: s.startTime.slice(0, 10),
    distKm: Math.round((s.distanceM / 1000) * 100) / 100,
    durMin: Math.round((s.durationSec / 60) * 10) / 10,
    avgHr: s.avgHr,
    trimp: Math.round(trimpBanister(trimpSamples, p.hrRest, p.hrMax, p.sex) * 10) / 10,
    zonePct: zoneSecs.map((z) => Math.round((z / totalZ) * 100)),
    decouplingPct: aerobicDecoupling(efPairs),
  };
}
