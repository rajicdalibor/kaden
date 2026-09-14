import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeSessionMetrics, ctlAtlTsb } from "./index.js";
import type { RawSession } from "@kaden/shared-types";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");

// PLACEHOLDER profil - zameni svojim realnim HRmax/HRrest!
const profile = { hrMax: 180, hrRest: 50, sex: "male" as const };

const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));
const daily: Record<string, number> = {};
console.log(`Profil (PLACEHOLDER): HRmax=${profile.hrMax} HRrest=${profile.hrRest}\n`);
console.log("datum        km    min   HR  TRIMP  Z1-Z5 %            decoupl");
for (const f of files.sort()) {
  const s = JSON.parse(readFileSync(join(fixturesDir, f), "utf8")) as RawSession;
  const m = computeSessionMetrics(s, profile);
  daily[m.date] = m.trimp;
  const z = m.zonePct.map((x) => String(x).padStart(3)).join(" ");
  const dc = m.decouplingPct == null ? "  n/a" : `${m.decouplingPct}%`;
  console.log(
    `${m.date}  ${String(m.distKm).padStart(5)} ${String(m.durMin).padStart(5)} ` +
    `${String(m.avgHr).padStart(4)} ${String(m.trimp).padStart(6)}  ${z}   ${dc}`,
  );
}
const arr = Object.values(daily);
const { ctl, atl, tsb } = ctlAtlTsb(arr);
console.log(`\nCTL=${ctl.toFixed(1)} ATL=${atl.toFixed(1)} TSB=${tsb.toFixed(1)} (demo - traži punu istoriju)`);
