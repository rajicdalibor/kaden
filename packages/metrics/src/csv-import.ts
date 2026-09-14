import type { SessionMetrics, AthleteProfile } from "@kaden/shared-types";
import { trimpBanister } from "./trimp.js";

/**
 * Import Garmin Connect "Export CSV" (lista aktivnosti) → SessionMetrics[].
 *
 * CSV je summary-nivo (bez per-second HR stream-a), pa:
 *  - TRIMP = Banister nad JEDNIM uzorkom (avgHR preko celog trajanja) — konzervativno,
 *    sistematski niže od stream-TRIMP-a (Jensen), ali dosledno kroz celu istoriju.
 *  - zonePct = [0,0,0,0,0] i decouplingPct = null (nedostupno bez stream-a).
 *
 * Load kriva (CTL/ATL/TSB/ACWR) je smisao ovog puta; zone/decoupling traže FIT.
 */

/** Minimalni CSV parser koji poštuje navodnike i zareze unutar polja. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // "" → escaped quote
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** "1,755" → 1755, "20.01" → 20.01, "--"/"" → null. Zarez = separator hiljada. */
function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.replace(/,/g, "").trim();
  if (t === "" || t === "--") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "HH:MM:SS" ili "MM:SS" → sekunde. */
function durationToSec(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.trim().split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export interface CsvImportResult {
  metrics: SessionMetrics[];
  skipped: number; // redovi bez upotrebljivih HR/trajanja
}

export function importGarminCsv(
  csv: string,
  profile: Pick<AthleteProfile, "hrMax" | "hrRest" | "sex">,
): CsvImportResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { metrics: [], skipped: 0 };

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iDate = col("Date");
  const iDist = col("Distance");
  const iTime = col("Time");
  const iAvgHr = col("Avg HR");

  const metrics: SessionMetrics[] = [];
  let skipped = 0;

  for (let r = 1; r < lines.length; r++) {
    const f = parseCsvLine(lines[r]);
    const dateRaw = f[iDate]?.trim() ?? "";
    const durSec = durationToSec(f[iTime]);
    const avgHr = num(f[iAvgHr]);
    const distKm = num(f[iDist]);

    if (!dateRaw || durSec == null || avgHr == null) { skipped++; continue; }

    const durMin = durSec / 60;
    const trimp = trimpBanister(
      [{ hr: avgHr, dtMin: durMin }],
      profile.hrRest, profile.hrMax, profile.sex,
    );

    metrics.push({
      sessionId: dateRaw.replace(/[^0-9]/g, ""), // stabilan id iz timestamp-a
      date: dateRaw.slice(0, 10),
      distKm: distKm == null ? 0 : Math.round(distKm * 100) / 100,
      durMin: Math.round(durMin * 10) / 10,
      avgHr,
      trimp: Math.round(trimp * 10) / 10,
      zonePct: [0, 0, 0, 0, 0], // nedostupno iz CSV summary-ja
      decouplingPct: null,
    });
  }

  return { metrics, skipped };
}
