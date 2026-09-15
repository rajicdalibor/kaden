/**
 * Demo: per-workout coach na FIT-derived sesijama.
 *   pnpm --filter @kaden/functions analyze [sessionId]
 * Default fokus = najskorija sesija. Ključ: ANTHROPIC_API_KEY iz .env (root).
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { AthleteProfile, type RawSession, type SessionMetrics } from "@kaden/shared-types";
import { computeSessionMetrics } from "@kaden/metrics";
import { analyzeSession } from "./coach.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
try { process.loadEnvFile(join(repoRoot, ".env")); } catch { /* ključ može iz env-a */ }
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("✗ Nedostaje ANTHROPIC_API_KEY (.env u root-u)."); process.exit(1); }

const profile = AthleteProfile.parse({
  uid: "dev-local", sex: "male", hrMax: 191, hrRest: 49, lthr: 169,
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120 },
});

const fitDir = join(repoRoot, "packages", "metrics", "fixtures-fit");
const raws: RawSession[] = readdirSync(fitDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(fitDir, f), "utf8")) as RawSession);
if (raws.length === 0) { console.error("Nema FIT sesija u fixtures-fit/ (pokreni: pnpm --filter @kaden/metrics fit ...)"); process.exit(1); }

const pace = (durMin: number, distKm: number) => {
  const s = Math.round((durMin * 60) / distKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
};
const enrich = (r: RawSession, m: SessionMetrics) => ({
  date: m.date,
  distKm: m.distKm, durMin: m.durMin, pace: pace(m.durMin, m.distKm),
  avgHr: m.avgHr, maxHr: r.maxHr, trimp: m.trimp,
  zonePctLthr: m.zonePct, decouplingPct: m.decouplingPct,
  avgRunCadenceSpm: r.avgRunCadence != null ? r.avgRunCadence * 2 : null,
  totalAscentM: r.totalAscent,
  garminTrainingEffect: r.deviceTrainingEffect,
  garminAnaerobicTE: r.deviceAnaerobicTE,
  garminTrainingLoad: r.deviceTrainingLoad,
});

const enriched = raws
  .map((r) => enrich(r, computeSessionMetrics(r, profile)))
  .sort((a, b) => a.date.localeCompare(b.date));

const focusId = process.argv[2];
const focus = focusId
  ? enriched.find((e) => raws.find((r) => r.sessionId === focusId && r.startTime.slice(0, 10) === e.date))
    ?? enriched[enriched.length - 1]
  : enriched[enriched.length - 1];
const history = enriched.filter((e) => e !== focus);

// Lap detalji SAMO za fokus sesiju (za lap-po-lap analizu; istoriju držimo sažeto).
const focusRaw = raws.find((r) => r.startTime.slice(0, 10) === focus.date);
const focusLaps = (focusRaw?.laps ?? []).map((l, i) => ({
  lap: i + 1,
  km: Math.round((l.distanceM / 1000) * 100) / 100,
  pace: l.durationSec > 0 && l.distanceM > 0 ? pace(l.durationSec / 60, l.distanceM / 1000) : null,
  avgHr: l.avgHr,
  maxHr: l.maxHr,
}));

const today = "2026-09-15";
const weeksToRace = Math.round(((Date.parse("2026-10-11") - Date.parse(today)) / (7 * 86400000)) * 10) / 10;
const phase = weeksToRace <= 1 ? "race_week" : weeksToRace <= 2 ? "taper" : "build";

const context = {
  athlete: {
    age: 43, hrMax: 191, lthr: 169, restHr: 49,
    zonesLthr: "Z1<114, Z2 115-133, Z3 134-152, Z4 153-169, Z5>169",
    praktičnaPravila: "recovery <145, long 140-152 (idealno <150), tempo 155-169, intervali 167-176, siva zona (izbegavati na easy) 150-160",
    kadencaCilj: "164-167 spm",
  },
  goalContext: { race: "Zagreb polumaraton", dateISO: "2026-10-11", weeksToRace, phase, cilj: "sub-2h (pace 5:41/km)" },
  focusSession: { ...focus, laps: focusLaps },
  recentHistory: history,
  coachingMemory: { observations: [] as string[] },
};

console.log(`→ Fokus trening: ${focus.date}  ${focus.distKm}km  ${focus.pace}  HR ${focus.avgHr}/${focus.maxHr}`);
console.log(`  Istorija za poređenje: ${history.length} sesija | weeksToRace=${weeksToRace} (${phase})`);
console.log("→ Zovem coacha (Sonnet)...\n");

const a = await analyzeSession(context, apiKey);

const line = "─".repeat(64);
console.log(line);
console.log(`ANALIZA — ${a.date}  [${a.classification}]  verdikt: ${a.verdict}`);
console.log(line);
console.log(`\n📊 Osnovni brojevi\n${a.basics}`);
console.log(`\n🎯 Zone\n${a.zones}`);
console.log(`\n💬 Iskrena ocena\n${a.assessment}`);
console.log(`\n📈 Poređenje sa prethodnim`);
for (const c of a.comparisons) console.log(`  • ${c}`);
console.log(`\n➡️  Sledeći korak\n${a.nextStep}`);
console.log(`\n❓ Pitanje\n${a.question}`);
console.log(`\nℹ️  ${a.coachingNote}`);
if (a.memoryUpdate.length) {
  console.log(`\n🧠 Za memoriju:`);
  for (const m of a.memoryUpdate) console.log(`  • ${m}`);
}
