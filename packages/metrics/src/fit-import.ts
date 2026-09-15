import FitParser from "fit-file-parser";
import { RawSession } from "@kaden/shared-types";

/**
 * Parsira Garmin FIT (activity) → RawSession (shared-types).
 * Izvlači i Garmin-native metrike koje NE prolaze kroz HealthKit:
 * training_load_peak, total_training_effect, total_anaerobic_training_effect.
 * hrStream = per-second {t, hr, spd} iz record poruka.
 */
export async function parseFitBuffer(
  content: ArrayBuffer | Buffer,
  sessionId: string,
): Promise<RawSession> {
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
    mode: "list",
  });
  const data = await parser.parseAsync(content as any);

  const s: any = data.sessions?.[0];
  if (!s) throw new Error(`FIT bez session poruke (${sessionId})`);
  const records: any[] = data.records ?? [];
  const rawLaps: any[] = data.laps ?? [];

  const laps = rawLaps.map((l) => ({
    distanceM: l.total_distance ?? 0,
    durationSec: l.total_timer_time ?? l.total_elapsed_time ?? 0,
    avgHr: typeof l.avg_heart_rate === "number" ? l.avg_heart_rate : null,
    maxHr: typeof l.max_heart_rate === "number" ? l.max_heart_rate : null,
    avgSpeed:
      typeof l.enhanced_avg_speed === "number"
        ? l.enhanced_avg_speed
        : typeof l.avg_speed === "number"
          ? l.avg_speed
          : null,
  }));

  const iso = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : String(v);

  const hrStream = records
    .filter((r) => r.timestamp != null)
    .map((r) => ({
      t: iso(r.timestamp),
      hr: typeof r.heart_rate === "number" ? r.heart_rate : null,
      spd:
        typeof r.enhanced_speed === "number"
          ? r.enhanced_speed
          : typeof r.speed === "number"
            ? r.speed
            : 0,
    }));

  const raw = {
    sessionId,
    startTime: iso(s.start_time),
    sport: typeof s.sport === "string" ? s.sport : "running",
    durationSec: s.total_timer_time ?? s.total_elapsed_time ?? 0,
    distanceM: s.total_distance ?? 0,
    avgHr: s.avg_heart_rate ?? null,
    maxHr: s.max_heart_rate ?? null,
    avgRunCadence: s.avg_cadence ?? null,
    totalAscent: s.total_ascent ?? null,
    calories: s.total_calories ?? null,
    deviceTrainingEffect: s.total_training_effect ?? null,
    deviceAnaerobicTE: s.total_anaerobic_training_effect ?? null,
    deviceTrainingLoad: s.training_load_peak ?? null,
    sampleCount: records.length,
    laps,
    hrStream,
  };

  return RawSession.parse(raw); // ugovor validiran pre upotrebe
}
