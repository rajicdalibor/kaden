/**
 * Lokalni runner za presudni test: učitaj MetricsSummary (default iz
 * @kaden/metrics demo izlaza), pozovi Sonnet, ispiši validiran CoachPlan.
 *
 * Pokretanje:
 *   pnpm --filter @kaden/functions plan:local
 *   pnpm --filter @kaden/functions plan:local ../packages/metrics/summary.local.json
 *
 * Ključ: ANTHROPIC_API_KEY iz .env u root-u repo-a (u .gitignore).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { MetricsSummary } from "@kaden/shared-types";
import { generatePlan } from "./sonnet.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

// .env iz root-a (Node 22: process.loadEnvFile)
try {
  process.loadEnvFile(join(repoRoot, ".env"));
} catch {
  // .env opciono; ključ može doći i iz okruženja
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    "✗ Nedostaje ANTHROPIC_API_KEY. Dodaj ga u .env (root repo-a) — vidi .env.example.",
  );
  process.exit(1);
}

const summaryPath =
  process.argv[2] ?? join(repoRoot, "packages", "metrics", "summary.local.json");

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch {
  console.error(
    `✗ Ne mogu da učitam summary: ${summaryPath}\n` +
      "  Prvo pokreni: pnpm --filter @kaden/metrics demo",
  );
  process.exit(1);
}

const summary = MetricsSummary.parse(raw); // ugovor validiran pre slanja LLM-u

console.log(`→ Summary: ${summaryPath}`);
console.log(
  `  athlete HRmax=${summary.athlete.hrMax} HRrest=${summary.athlete.hrRest}, ` +
    `${summary.rollingWeeks.length} nedelja, ${summary.recentSessions.length} recent, ` +
    `flags=[${summary.flags.join(", ")}]`,
);
console.log("→ Zovem Sonnet...\n");

const plan = await generatePlan(summary, apiKey);

console.log("=== CoachPlan (validiran Zod-om) ===");
console.log("assessment:", plan.assessment);
console.log("\nkeyObservations:");
for (const o of plan.keyObservations) console.log("  •", o);
if (plan.riskFlags.length) {
  console.log("\nriskFlags:");
  for (const r of plan.riskFlags) console.log(`  [${r.severity}] ${r.type}: ${r.detail}`);
}
console.log("\nnextWeekPlan:");
for (const s of plan.nextWeekPlan) {
  const km = s.distanceKm == null ? "—" : `${s.distanceKm}km`;
  console.log(`  ${s.day.toUpperCase()}  ${s.type.padEnd(10)} ${km.padStart(6)}  ${s.target}`);
  console.log(`        ↳ ${s.purpose}`);
}
console.log("\nadjustmentsVsLastWeek:", plan.adjustmentsVsLastWeek);
console.log("\ncoachingNote:", plan.coachingNote);
