import type { AthleteProfile, GoalContext } from "@kaden/shared-types";
import { vdotFromRace, raceDistanceM } from "./vdot.js";

/**
 * Deterministički kontekst cilja: nedelje do trke, faza periodizacije, ciljni
 * trkački tempo i VDOT potreban za cilj. LLM ove brojeve dobija gotove.
 */
export function buildGoalContext(
  profile: AthleteProfile,
  asOfISO: string,
): GoalContext | null {
  const g = profile.goal;
  if (!g) return null;

  const dist = raceDistanceM(g.race);
  let weeksToRace: number | null = null;
  let phase: GoalContext["phase"] = "none";
  if (g.dateISO) {
    const days =
      (Date.parse(`${g.dateISO}T00:00:00Z`) - Date.parse(`${asOfISO}T00:00:00Z`)) / 86400000;
    weeksToRace = Math.round((days / 7) * 10) / 10;
    phase =
      days < 0 ? "none"
        : weeksToRace <= 1 ? "race_week"
        : weeksToRace <= 2 ? "taper"
        : weeksToRace <= 6 ? "peak"
        : "build";
  }

  let targetPaceSecPerKm: number | null = null;
  let requiredVdot: number | null = null;
  if (g.targetTimeMin && dist) {
    targetPaceSecPerKm = Math.round((g.targetTimeMin * 60) / (dist / 1000));
    requiredVdot = Math.round(vdotFromRace(dist, g.targetTimeMin * 60) * 10) / 10;
  }

  return { race: g.race, dateISO: g.dateISO, weeksToRace, phase, targetPaceSecPerKm, requiredVdot };
}
