import type {
  RawSession,
  SessionMetrics,
  WeeklyMetrics,
  MetricsSummary,
  AthleteProfile,
} from "@kaden/shared-types";
import { computeSessionMetrics } from "./index.js";
import { ewma, acwr } from "./load.js";

/** ISO 8601 nedelja: "YYYY-Www" (npr "2026-W37"). Deterministički, UTC. */
export function isoWeek(dateISO: string): string {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3); // pomeri na četvrtak te nedelje
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  const week =
    1 +
    Math.round(
      (d.getTime() - firstThursday.getTime()) / 86400000 / 7 -
        (3 - ftDay) / 7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Polarization index (Treff i sar. 2019): log10(low × mod / high² × 100).
 * 5-zonski model → 3 pojasa: low=Z1+Z2, mod=Z3, high=Z4+Z5.
 * ≥ 2.0 = polarizovano. null ako neki pojas nema vremena (nedefinisano).
 */
export function polarizationIndex(zoneDistPct: number[]): number | null {
  const low = zoneDistPct[0] + zoneDistPct[1];
  const mod = zoneDistPct[2];
  const high = zoneDistPct[3] + zoneDistPct[4];
  if (low <= 0 || mod <= 0 || high <= 0) return null;
  return Math.round(Math.log10(((low * mod) / (high * high)) * 100) * 100) / 100;
}

/** Nedelja (kraj ISO nedelje) za dati datum, kao "YYYY-MM-DD" (UTC). */
export function endOfIsoWeek(dateISO: string): string {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`);
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + (7 - isoDow));
  return d.toISOString().slice(0, 10);
}

/** Enumeriši sve kalendarske dane [startISO..endISO] uključivo (UTC). */
function dateSpan(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const d = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  while (d.getTime() <= end.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface BuildSummaryOptions {
  /** Koliko poslednjih sesija ide u recentSessions (default 10). */
  recentCount?: number;
  /** Dodatni top-level flag-ovi (npr. izvor podataka) — dodaju se na kraj. */
  extraFlags?: string[];
  /** Dan planiranja "YYYY-MM-DD" (default: nedelja poslednje ISO nedelje). */
  asOf?: string;
}

/**
 * Glavni builder: N sirovih sesija + profil → MetricsSummary za LLM.
 * Deterministički, bez LLM-a. Sklapa rolling weekly rollup, recent sesije i flag-ove.
 *
 * CTL(42d)/ATL(7d)/TSB računaju se nad DNEVNIM nizom TRIMP-a preko celog raspona
 * (rupe = dani odmora = 0), pa se uzorkuju na kraju svake ISO nedelje.
 */
export function buildMetricsSummary(
  sessions: RawSession[],
  profile: AthleteProfile,
  opts: BuildSummaryOptions = {},
): MetricsSummary {
  const metrics = sessions
    .map((s) => computeSessionMetrics(s, profile))
    .sort((a, b) => a.date.localeCompare(b.date));
  return buildSummaryFromMetrics(metrics, profile, opts);
}

/**
 * Isto kao buildMetricsSummary, ali prima GOTOVE per-session metrike.
 * Koristi se za izvore bez HR stream-a (npr. Garmin CSV): tamo se TRIMP računa
 * iz avgHR+trajanja, a zonePct/decoupling nisu dostupni.
 */
export function buildSummaryFromMetrics(
  input: SessionMetrics[],
  profile: AthleteProfile,
  opts: BuildSummaryOptions = {},
): MetricsSummary {
  const recentCount = opts.recentCount ?? 10;
  const metrics = [...input].sort((a, b) => a.date.localeCompare(b.date));

  const summaryFlags: string[] = [];

  if (metrics.length === 0) {
    return {
      athlete: profile,
      rollingWeeks: [],
      recentSessions: [],
      flags: ["no_sessions"],
    };
  }

  // 2) dnevni TRIMP niz preko punog raspona (rupe = 0)
  const dailyTrimpByDate = new Map<string, number>();
  for (const m of metrics) {
    dailyTrimpByDate.set(m.date, (dailyTrimpByDate.get(m.date) ?? 0) + m.trimp);
  }
  // asOf = dan planiranja (podrazumevano nedelja poslednje ISO nedelje → determinističko
  // za testove; runneri prosleđuju "danas"). Raspon se produžava do asOf sa danima odmora
  // (rupe = 0) da bi trenutna forma odražavala stvaran broj dana od poslednjeg treninga,
  // a sve nedelje bile uzorkovane u istoj fazi mikrociklusa (kraj nedelje), ne na dan runa.
  const lastDate = metrics[metrics.length - 1].date;
  const asOf = opts.asOf ?? endOfIsoWeek(lastDate);
  const end = asOf > lastDate ? asOf : endOfIsoWeek(lastDate);
  const span = dateSpan(metrics[0].date, end);
  const daily = span.map((d) => dailyTrimpByDate.get(d) ?? 0);
  const ctlSeries = ewma(daily, 42);
  const atlSeries = ewma(daily, 7);

  // Za svaku ISO nedelju: indeks POSLEDNJEG KALENDARSKOG dana (nedelja) u rasponu.
  // Uzorkovanje na fiksnoj tački nedelje uklanja bias uzorkovanja na dan najtežeg
  // treninga (dugi/teški run bi lažno obarao TSB).
  const weekLastDayIndex = new Map<string, number>();
  for (let i = 0; i < span.length; i++) weekLastDayIndex.set(isoWeek(span[i]), i);

  const distinctDays = dailyTrimpByDate.size;
  const historyDays = span.length;
  if (historyDays < 28) {
    summaryFlags.push("insufficient_history_for_load"); // CTL/ATL/ACWR nepouzdani
  }

  // 3) grupisanje po ISO nedelji
  const byWeek = new Map<string, SessionMetrics[]>();
  for (const m of metrics) {
    const w = isoWeek(m.date);
    (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(m);
  }

  // 4) weekly rollup
  const weekKeys = [...byWeek.keys()].sort();
  const rollingWeeks: WeeklyMetrics[] = [];
  let prevVolume: number | null = null;

  for (const wk of weekKeys) {
    const ws = byWeek.get(wk)!;
    const volumeKm = round1(ws.reduce((s, m) => s + m.distKm, 0));

    // zone dist ponderisano trajanjem sesije
    const zoneSecs = [0, 0, 0, 0, 0];
    for (const m of ws) {
      for (let z = 0; z < 5; z++) zoneSecs[z] += (m.durMin * m.zonePct[z]) / 100;
    }
    const zonesKnown = ws.some((m) => m.zonePct.reduce((a, b) => a + b, 0) > 0);
    const totZ = zoneSecs.reduce((a, b) => a + b, 0) || 1;
    const zoneDistPct = zoneSecs.map((z) => Math.round((z / totZ) * 100));

    // uzorkuj load na kraju kalendarske ISO nedelje (fiksna tačka, ne dan treninga)
    const idx = weekLastDayIndex.get(wk)!;
    const ctl = round1(ctlSeries[idx] ?? 0);
    const atl = round1(atlSeries[idx] ?? 0);
    const tsb = round1(ctl - atl);
    const weekAcwr = acwr(daily.slice(0, idx + 1));

    const flags: string[] = [];
    if (!zonesKnown) flags.push("zones_unavailable");
    if (weekAcwr != null && weekAcwr > 1.5) flags.push("acwr_high_injury_risk");
    if (weekAcwr != null && weekAcwr < 0.8) flags.push("acwr_detraining");
    if (tsb < -20) flags.push("high_fatigue");
    if (prevVolume != null && prevVolume > 0) {
      const jump = (volumeKm - prevVolume) / prevVolume;
      if (jump > 0.1) flags.push("volume_jump_gt_10pct");
    }

    rollingWeeks.push({
      isoWeek: wk,
      volumeKm,
      sessions: ws.length,
      zoneDistPct,
      polarizationIndex: polarizationIndex(zoneDistPct),
      ctl,
      atl,
      tsb,
      acwr: weekAcwr,
      flags,
    });
    prevVolume = volumeKm;
  }

  // 5) recent sesije (poslednjih N)
  const recentSessions = metrics.slice(-recentCount);

  // 6) top-level flags
  if (recentSessions.some((m) => m.decouplingPct != null && m.decouplingPct > 10)) {
    summaryFlags.push("high_decoupling_recent");
  }
  if (distinctDays < 3) summaryFlags.push("sparse_data");
  const lastWeekFlags = rollingWeeks[rollingWeeks.length - 1]?.flags ?? [];
  for (const f of lastWeekFlags) if (!summaryFlags.includes(f)) summaryFlags.push(f);

  // Trenutna forma NA DAN planiranja (eksplicitno, ne kao lažna nedelja): TSB/CTL/ATL
  // uzorkovani na asOf + koliko dana je prošlo od poslednjeg treninga. Ovo govori
  // modelu da je nova nedelja tek počela (0 km zasad NE znači nedelja odmora).
  if (opts.asOf) {
    const i = span.indexOf(opts.asOf);
    if (i >= 0) {
      const ctl = round1(ctlSeries[i] ?? 0);
      const atl = round1(atlSeries[i] ?? 0);
      const days = Math.round(
        (Date.parse(`${opts.asOf}T00:00:00Z`) - Date.parse(`${lastDate}T00:00:00Z`)) / 86400000,
      );
      summaryFlags.push(
        `trenutna_forma_na_${opts.asOf}: TSB=${round1(ctl - atl)} CTL=${ctl} ATL=${atl}; ` +
          `${days} dan(a) od poslednjeg treninga; nova nedelja tek pocinje`,
      );
    }
  }

  for (const f of opts.extraFlags ?? []) if (!summaryFlags.includes(f)) summaryFlags.push(f);

  return {
    athlete: profile,
    rollingWeeks,
    recentSessions,
    flags: summaryFlags,
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
