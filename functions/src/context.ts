import type { RawSession, AthleteProfile, GoalContext, CoachingMemory } from "@kaden/shared-types";
import { computeSessionMetrics, fmtPace, LTHR_ZONE_BOUNDS } from "@kaden/metrics";

/** Zajednička izgradnja konteksta za per-workout coacha (lokalni runner + backend). */

export function paceStr(durMin: number, distKm: number): string {
  const s = Math.round((durMin * 60) / distKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
}

/** Sažetak sesije za coach kontekst (BEZ lapova — istorija mora biti kompaktna). */
export function enrichForCoach(raw: RawSession, profile: AthleteProfile) {
  const m = computeSessionMetrics(raw, profile);
  return {
    sessionId: raw.sessionId,
    date: m.date,
    distKm: m.distKm, durMin: m.durMin, pace: paceStr(m.durMin, m.distKm),
    avgHr: m.avgHr, maxHr: raw.maxHr, trimp: m.trimp,
    zonePctLthr: m.zonePct, decouplingPct: m.decouplingPct,
    avgRunCadenceSpm: raw.avgRunCadence != null ? raw.avgRunCadence * 2 : null,
    totalAscentM: raw.totalAscent,
    garminTrainingEffect: raw.deviceTrainingEffect,
    garminAnaerobicTE: raw.deviceAnaerobicTE,
    garminTrainingLoad: raw.deviceTrainingLoad,
  };
}

/** Lap detalji (samo za fokus sesiju). */
export function lapsForCoach(raw: RawSession) {
  return raw.laps.map((l, i) => ({
    lap: i + 1,
    km: Math.round((l.distanceM / 1000) * 100) / 100,
    pace: l.durationSec > 0 && l.distanceM > 0 ? paceStr(l.durationSec / 60, l.distanceM / 1000) : null,
    avgHr: l.avgHr, maxHr: l.maxHr,
  }));
}

/** Isti sažetak kao enrichForCoach, ali iz Firestore session doc-a (metrics već upisan). */
export function enrichFromDoc(doc: any) {
  const m = doc.metrics;
  return {
    sessionId: doc.sessionId,
    date: m.date,
    distKm: m.distKm, durMin: m.durMin, pace: paceStr(m.durMin, m.distKm),
    avgHr: m.avgHr, maxHr: doc.maxHr ?? null, trimp: m.trimp,
    zonePctLthr: m.zonePct, decouplingPct: m.decouplingPct,
    avgRunCadenceSpm: doc.avgRunCadence != null ? doc.avgRunCadence * 2 : null,
    totalAscentM: doc.totalAscent ?? null,
    garminTrainingEffect: doc.deviceTrainingEffect ?? null,
    garminAnaerobicTE: doc.deviceAnaerobicTE ?? null,
    garminTrainingLoad: doc.deviceTrainingLoad ?? null,
  };
}
export function lapsFromDoc(doc: any) {
  return (doc.laps ?? []).map((l: any, i: number) => ({
    lap: i + 1,
    km: Math.round((l.distanceM / 1000) * 100) / 100,
    pace: l.durationSec > 0 && l.distanceM > 0 ? paceStr(l.durationSec / 60, l.distanceM / 1000) : null,
    avgHr: l.avgHr, maxHr: l.maxHr,
  }));
}

export function athleteBlock(profile: AthleteProfile) {
  const lthr = profile.lthr;
  const b = lthr ? LTHR_ZONE_BOUNDS.map((f) => Math.round(f * lthr)) : null;
  return {
    age: profile.birthYear ? new Date().getUTCFullYear() - profile.birthYear : null,
    hrMax: profile.hrMax, lthr, restHr: profile.hrRest,
    zonesLthr: b ? `Z1<${b[0]}, Z2 ${b[0]}-${b[1]}, Z3 ${b[1]}-${b[2]}, Z4 ${b[2]}-${b[3]}, Z5>${b[3]}` : null,
    kadencaCilj: "164-167 spm",
    notes: profile.notes ?? null,
  };
}

export interface AnalysisContextInput {
  profile: AthleteProfile;
  focus: ReturnType<typeof enrichForCoach>;
  focusLaps: ReturnType<typeof lapsForCoach>;
  history: ReturnType<typeof enrichForCoach>[];
  goalContext: GoalContext | null;
  memory?: CoachingMemory;
  /** planirani intent + subjektivni check-in (plan vs. stvarnost). */
  intent?: Record<string, unknown>;
}

export function assembleContext(inp: AnalysisContextInput) {
  const gc = inp.goalContext;
  return {
    athlete: athleteBlock(inp.profile),
    goalContext: gc
      ? { ...gc, ciljniTempo: gc.targetPaceSecPerKm != null ? fmtPace(gc.targetPaceSecPerKm) : null }
      : null,
    focusSession: { ...inp.focus, laps: inp.focusLaps, ...(inp.intent ?? {}) },
    recentHistory: inp.history,
    coachingMemory: inp.memory ?? { observations: [], respondsWellTo: [], avoid: [] },
  };
}
