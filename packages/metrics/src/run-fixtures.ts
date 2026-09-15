import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeSessionMetrics, buildMetricsSummary } from "./index.js";
import { AthleteProfile, type RawSession } from "@kaden/shared-types";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");

// Realni profil (Dalibor): Max 191, LTHR 169, rest 49, LTHR zone. Override iz env-a.
const profile = AthleteProfile.parse({
  uid: "dev-local",
  sex: "male",
  hrMax: Number(process.env.HRMAX ?? 191),
  hrRest: Number(process.env.HRREST ?? 49),
  lthr: Number(process.env.LTHR ?? 169),
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120 },
});

const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
const sessions: RawSession[] = files
  .sort()
  .map((f) => JSON.parse(readFileSync(join(fixturesDir, f), "utf8")) as RawSession);

const placeholder = !process.env.HRMAX && !process.env.HRREST;
console.log(
  `Profil${placeholder ? " (PLACEHOLDER)" : ""}: HRmax=${profile.hrMax} HRrest=${profile.hrRest}\n`,
);
console.log("datum        km    min   HR  TRIMP  Z1-Z5 %            decoupl");
for (const s of sessions) {
  const m = computeSessionMetrics(s, profile);
  const z = m.zonePct.map((x) => String(x).padStart(3)).join(" ");
  const dc = m.decouplingPct == null ? "  n/a" : `${m.decouplingPct}%`;
  console.log(
    `${m.date}  ${String(m.distKm).padStart(5)} ${String(m.durMin).padStart(5)} ` +
      `${String(m.avgHr).padStart(4)} ${String(m.trimp).padStart(6)}  ${z}   ${dc}`,
  );
}

// --- MetricsSummary za LLM ---
const summary = buildMetricsSummary(sessions, profile);
console.log("\n=== MetricsSummary (ulaz za Sonnet) ===");
for (const w of summary.rollingWeeks) {
  console.log(
    `${w.isoWeek}  vol=${w.volumeKm}km  n=${w.sessions}  ` +
      `Z=[${w.zoneDistPct.join(",")}]  PI=${w.polarizationIndex}  ` +
      `CTL=${w.ctl} ATL=${w.atl} TSB=${w.tsb}  ACWR=${w.acwr}  ` +
      `flags=[${w.flags.join(",")}]`,
  );
}
console.log(`top-level flags: [${summary.flags.join(", ")}]`);

const outPath = join(here, "..", "summary.local.json");
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\n→ sačuvano: ${outPath} (ulaz za sonnet runner)`);
