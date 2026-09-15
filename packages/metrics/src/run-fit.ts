import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFitBuffer } from "./fit-import.js";

/**
 * Konvertuj .fit → RawSession JSON (validiran). Snima u fixtures-fit/ (gitignored).
 *   pnpm --filter @kaden/metrics fit ~/Downloads/24360297055_ACTIVITY.fit [...]
 * sessionId = broj iz imena fajla (pre prvog _), ili ceo basename.
 */
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "fixtures-fit");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Upotreba: fit <putanja.fit> [...]");
  process.exit(1);
}

for (const p of paths) {
  const id = basename(p).split("_")[0].replace(/\.fit$/i, "");
  const buf = readFileSync(p);
  const raw = await parseFitBuffer(buf, id);
  const out = join(outDir, `${id}.json`);
  writeFileSync(out, JSON.stringify(raw, null, 2));
  console.log(
    `${id}  ${raw.startTime.slice(0, 10)}  ${(raw.distanceM / 1000).toFixed(2)}km  ` +
      `${(raw.durationSec / 60).toFixed(1)}min  HR ${raw.avgHr}/${raw.maxHr}  ` +
      `TE ${raw.deviceTrainingEffect} AnTE ${raw.deviceAnaerobicTE} Load ${raw.deviceTrainingLoad?.toFixed(1)}  ` +
      `samples ${raw.sampleCount} → ${out}`,
  );
}
