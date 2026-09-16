import {
  isHealthDataAvailable,
  requestAuthorization,
  queryWorkoutSamples,
  queryQuantitySamples,
} from "@kingstinct/react-native-healthkit";
import type { RawSession } from "@kaden/shared-types";

/** Traži read dozvolu za trčanja + puls + distancu. */
export async function ensureHealthPermission(): Promise<boolean> {
  if (!isHealthDataAvailable()) return false;
  await requestAuthorization({
    toRead: [
      "HKWorkoutTypeIdentifier",
      "HKQuantityTypeIdentifierHeartRate",
      "HKQuantityTypeIdentifierDistanceWalkingRunning",
    ],
  });
  return true;
}

function isRunning(t: unknown): boolean {
  // WorkoutActivityType može biti string ('running') ili numerički (37 = running).
  return t === 37 || String(t).toLowerCase().includes("run");
}

/**
 * Najskorije trčanje iz Apple Health → RawSession (za /sync).
 * HealthKit daje HR uzorke + distancu/trajanje (dovoljno za zone/TRIMP/decoupling);
 * per-lap i Garmin-native polja ne postoje ovde (to je FIT).
 */
export async function latestRunAsRawSession(): Promise<RawSession | null> {
  const workouts = await queryWorkoutSamples({ limit: 20 });
  const run = workouts
    .filter((w) => isRunning(w.workoutActivityType))
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate))[0];
  if (!run) return null;

  const start = new Date(run.startDate);
  const end = new Date(run.endDate);
  const durationSec = (+end - +start) / 1000;
  const distanceM = run.totalDistance?.quantity ?? 0;
  const avgSpd = durationSec > 0 ? distanceM / durationSec : 0;

  const hrSamples = await queryQuantitySamples("HKQuantityTypeIdentifierHeartRate", {
    unit: "count/min",
    limit: -1,
    ascending: true,
    filter: { date: { startDate: start, endDate: end } },
  });

  const hrStream = hrSamples.map((s) => ({
    t: new Date(s.startDate).toISOString(),
    hr: Math.round(s.quantity),
    spd: avgSpd, // HK HR uzorci nemaju brzinu → prosečna (dovoljno za zone/TRIMP)
  }));
  const hrs = hrStream.map((s) => s.hr).filter((h) => h > 0);
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
  const maxHr = hrs.length ? Math.max(...hrs) : null;

  return {
    sessionId: "hk-" + start.toISOString().replace(/[^0-9]/g, "").slice(0, 14),
    startTime: start.toISOString(),
    sport: "running",
    durationSec,
    distanceM,
    avgHr,
    maxHr,
    avgRunCadence: null,
    totalAscent: null,
    calories: null,
    deviceTrainingEffect: null,
    deviceAnaerobicTE: null,
    deviceTrainingLoad: null,
    sampleCount: hrStream.length,
    laps: [],
    hrStream,
  };
}
