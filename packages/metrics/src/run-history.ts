import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { importGarminCsv, buildSummaryFromMetrics } from "./index.js";
import { AthleteProfile } from "@kaden/shared-types";

const here = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] ?? join(here, "..", "history.local.csv");

const profile = AthleteProfile.parse({
  uid: "dev-local",
  sex: "male",
  hrMax: Number(process.env.HRMAX ?? 191),
  hrRest: Number(process.env.HRREST ?? 49),
  lthr: Number(process.env.LTHR ?? 169),
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120 },
});

const csv = readFileSync(csvPath, "utf8");
const { metrics, skipped } = importGarminCsv(csv, profile);
console.log(
  `Učitano ${metrics.length} trčanja iz CSV-a (preskočeno ${skipped}). ` +
    `Profil: HRmax=${profile.hrMax} HRrest=${profile.hrRest}`,
);
if (metrics.length === 0) { console.error("Nema upotrebljivih redova."); process.exit(1); }

const asOf = process.env.ASOF ?? new Date().toISOString().slice(0, 10);
const summary = buildSummaryFromMetrics(metrics, profile, {
  recentCount: 10,
  asOf, // dan planiranja = danas (uračunava dane odmora od poslednjeg treninga)
  extraFlags: [
    "history_source_csv_summary", // zone% i decoupling po sesiji NISU dostupni
  ],
});
console.log(`asOf (dan planiranja): ${asOf}`);

const first = metrics[0].date;
const last = metrics[metrics.length - 1].date;
console.log(`Raspon: ${first} → ${last}  (${summary.rollingWeeks.length} ISO nedelja)\n`);
console.log("nedelja    vol(km)  n   CTL   ATL   TSB   ACWR   flags");
for (const w of summary.rollingWeeks) {
  console.log(
    `${w.isoWeek}  ${String(w.volumeKm).padStart(6)}  ${w.sessions}  ` +
      `${String(w.ctl).padStart(5)} ${String(w.atl).padStart(5)} ${String(w.tsb).padStart(5)}  ` +
      `${String(w.acwr ?? "n/a").padStart(5)}  ${w.flags.join(",")}`,
  );
}
console.log(`\ntop-level flags: [${summary.flags.join(", ")}]`);

const outPath = join(here, "..", "summary.local.json");
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`\n→ sačuvano: ${outPath} (ulaz za: pnpm --filter @kaden/functions plan:local)`);
