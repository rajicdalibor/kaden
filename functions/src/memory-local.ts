import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CoachingMemory } from "@kaden/shared-types";

/** Lokalna persistencija CoachingMemory (demo; u produkciji Firestore po uid). */
const EMPTY: CoachingMemory = { observations: [], respondsWellTo: [], avoid: [] };
const CAP = 20;

export function loadMemory(path: string): CoachingMemory {
  if (!existsSync(path)) return { ...EMPTY };
  try {
    return CoachingMemory.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return { ...EMPTY };
  }
}

/** Spoji nova zapažanja (dedup, cap na poslednjih CAP), upiši i vrati. */
export function mergeMemory(
  path: string,
  mem: CoachingMemory,
  newObs: string[],
): CoachingMemory {
  const observations = [...mem.observations];
  for (const o of newObs) if (!observations.includes(o)) observations.push(o);
  const merged: CoachingMemory = {
    ...mem,
    observations: observations.slice(-CAP),
    updatedAtISO: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(merged, null, 2));
  return merged;
}
