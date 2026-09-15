/**
 * Demo kontinuiteta: analizira FIT sesije HRONOLOŠKI, akumulira CoachingMemory i
 * vraća je u svaku sledeću analizu → coach se referiše na prošla zapažanja.
 *   pnpm --filter @kaden/functions coach:replay
 */
import { readFileSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { AthleteProfile, type RawSession, type CoachingMemory } from "@kaden/shared-types";
import { computeSessionMetrics } from "@kaden/metrics";
import { analyzeSession } from "./coach.js";
import { mergeMemory } from "./memory-local.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
try { process.loadEnvFile(join(repoRoot, ".env")); } catch { /* env */ }
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("✗ Nedostaje ANTHROPIC_API_KEY (.env)."); process.exit(1); }

const profile = AthleteProfile.parse({
  uid: "dev-local", sex: "male", hrMax: 191, hrRest: 49, lthr: 169,
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120 },
});

const fitDir = join(repoRoot, "packages", "metrics", "fixtures-fit");
const raws: RawSession[] = readdirSync(fitDir).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(fitDir, f), "utf8")) as RawSession);

const pace = (durMin: number, distKm: number) => {
  const s = Math.round((durMin * 60) / distKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};
const items = raws.map((r) => {
  const m = computeSessionMetrics(r, profile);
  return {
    raw: r,
    e: {
      date: m.date, distKm: m.distKm, durMin: m.durMin, pace: pace(m.durMin, m.distKm),
      avgHr: m.avgHr, maxHr: r.maxHr, trimp: m.trimp, zonePctLthr: m.zonePct,
      decouplingPct: m.decouplingPct,
      avgRunCadenceSpm: r.avgRunCadence != null ? r.avgRunCadence * 2 : null,
      garminTrainingEffect: r.deviceTrainingEffect, garminAnaerobicTE: r.deviceAnaerobicTE,
      garminTrainingLoad: r.deviceTrainingLoad,
    },
  };
}).sort((a, b) => a.e.date.localeCompare(b.e.date));

const memPath = join(repoRoot, "coach-memory.local.json");
if (existsSync(memPath)) unlinkSync(memPath); // čist replay
let memory: CoachingMemory = { observations: [], respondsWellTo: [], avoid: [] };

const today = "2026-09-15";
const weeksToRace = Math.round(((Date.parse("2026-10-11") - Date.parse(today)) / (7 * 86400000)) * 10) / 10;

console.log(`Replay ${items.length} sesija hronološki (memorija se akumulira)\n${"═".repeat(64)}`);
let lastFull: any = null;

for (let i = 0; i < items.length; i++) {
  const { raw, e } = items[i];
  const history = items.slice(0, i).map((x) => x.e); // samo prošlost
  const focusLaps = raw.laps.map((l, k) => ({
    lap: k + 1, km: Math.round((l.distanceM / 1000) * 100) / 100,
    pace: l.durationSec > 0 && l.distanceM > 0 ? pace(l.durationSec / 60, l.distanceM / 1000) : null,
    avgHr: l.avgHr, maxHr: l.maxHr,
  }));
  const context = {
    athlete: {
      age: 43, hrMax: 191, lthr: 169, restHr: 49,
      zonesLthr: "Z1<114, Z2 115-133, Z3 134-152, Z4 153-169, Z5>169",
      praktičnaPravila: "recovery <145, long 140-152, tempo 155-169, intervali 167-176, siva zona 150-160",
      kadencaCilj: "164-167 spm",
    },
    goalContext: { race: "Zagreb polumaraton", dateISO: "2026-10-11", weeksToRace, cilj: "sub-2h (5:41/km)" },
    focusSession: { ...e, laps: focusLaps },
    recentHistory: history,
    coachingMemory: memory,
  };

  const priorCount = memory.observations.length;
  const a = await analyzeSession(context, apiKey);
  memory = mergeMemory(memPath, memory, a.memoryUpdate);
  lastFull = a;
  console.log(
    `\n${e.date}  [${a.classification}]  ${a.verdict}  (memorija ${priorCount} → ${memory.observations.length})`,
  );
  for (const o of a.memoryUpdate) console.log(`   + ${o}`);
}

console.log(`\n${"═".repeat(64)}\nAKUMULIRANA MEMORIJA (${memory.observations.length}):`);
for (const o of memory.observations) console.log(`  • ${o}`);
console.log(`\n${"═".repeat(64)}\nPOSLEDNJA ANALIZA U PUNOM (referiše se na memoriju):`);
console.log(`\n💬 ${lastFull.assessment}`);
console.log(`\n📈 Poređenje:`);
for (const c of lastFull.comparisons) console.log(`  • ${c}`);
console.log(`\n➡️  ${lastFull.nextStep}`);
console.log(`\n❓ ${lastFull.question}`);
