import { z } from "zod";

/**
 * SHARED CONTRACTS — jedini izvor istine za oblik podataka.
 * Deljeno između /functions (backend) i /apps/mobile (Expo).
 * Vlasnik: Architect/Lead agent. Menjati SAMO ovde.
 */

// ---------- Athlete profile ----------
export const HrZoneModel = z.enum(["pct_hrmax", "pct_hrr", "lactate"]);

export const AthleteProfile = z.object({
  uid: z.string(),
  birthYear: z.number().int().optional(),
  sex: z.enum(["male", "female"]).default("male"),
  weightKg: z.number().positive().optional(),
  hrMax: z.number().int().positive(),        // MORA biti tačan - diktira zone + TRIMP
  hrRest: z.number().int().positive(),
  zoneModel: HrZoneModel.default("pct_hrmax"),
  vdot: z.number().positive().optional(),
  goal: z.object({
    race: z.enum(["5k", "10k", "half_marathon", "marathon", "ultra", "general"]),
    dateISO: z.string().optional(),
    targetTimeMin: z.number().positive().optional(),
  }).optional(),
  weeklyAvailabilityDays: z.number().int().min(1).max(7).default(4),
  constraints: z.array(z.string()).default([]),
});
export type AthleteProfile = z.infer<typeof AthleteProfile>;

// ---------- Raw session (posle parsiranja FIT / HealthKit) ----------
export const HrSample = z.object({
  t: z.string(),                  // ISO timestamp
  hr: z.number().int().nullable(),
  spd: z.number().nonnegative(),  // m/s
});
export type HrSample = z.infer<typeof HrSample>;

export const RawSession = z.object({
  sessionId: z.string(),
  startTime: z.string(),
  sport: z.string(),
  durationSec: z.number(),
  distanceM: z.number(),
  avgHr: z.number().int().nullable(),
  maxHr: z.number().int().nullable(),
  avgRunCadence: z.number().nullable().optional(),
  totalAscent: z.number().nullable().optional(),
  calories: z.number().nullable().optional(),
  // Garmin-native (samo iz FIT import-a; null iz HealthKit/Health Connect):
  deviceTrainingEffect: z.number().nullable().optional(),
  deviceAnaerobicTE: z.number().nullable().optional(),
  deviceTrainingLoad: z.number().nullable().optional(),
  sampleCount: z.number().int(),
  hrStream: z.array(HrSample),    // NE ide u Firestore doc - u Cloud Storage
});
export type RawSession = z.infer<typeof RawSession>;

// ---------- Computed per-session metrics ----------
export const SessionMetrics = z.object({
  sessionId: z.string(),
  date: z.string(),
  distKm: z.number(),
  durMin: z.number(),
  avgHr: z.number().nullable(),
  trimp: z.number(),
  zonePct: z.array(z.number()).length(5),
  decouplingPct: z.number().nullable(),
});
export type SessionMetrics = z.infer<typeof SessionMetrics>;

// ---------- Weekly rollup ----------
export const WeeklyMetrics = z.object({
  isoWeek: z.string(),
  volumeKm: z.number(),
  sessions: z.number().int(),
  zoneDistPct: z.array(z.number()).length(5),
  polarizationIndex: z.number().nullable(),
  ctl: z.number(),
  atl: z.number(),
  tsb: z.number(),
  acwr: z.number().nullable(),
  flags: z.array(z.string()),
});
export type WeeklyMetrics = z.infer<typeof WeeklyMetrics>;

// ---------- LLM input summary ----------
export const MetricsSummary = z.object({
  athlete: AthleteProfile,
  rollingWeeks: z.array(WeeklyMetrics),
  recentSessions: z.array(SessionMetrics),
  flags: z.array(z.string()),
});
export type MetricsSummary = z.infer<typeof MetricsSummary>;

// ---------- LLM output (nametnuto preko tool use / structured output) ----------
export const PlannedSession = z.object({
  day: z.enum(["mon","tue","wed","thu","fri","sat","sun"]),
  type: z.enum(["easy","long","tempo","intervals","recovery","rest","race","cross"]),
  distanceKm: z.number().nullable(),
  target: z.string(),          // npr "Z2, 5:10-5:25/km"
  purpose: z.string(),
});
export const CoachPlan = z.object({
  assessment: z.object({
    fitnessTrend: z.enum(["improving","stable","declining"]),
    fatigueState: z.enum(["fresh","moderate","high"]),
    readiness: z.enum(["ready","ready_with_caution","hold_back"]),
  }),
  keyObservations: z.array(z.string()).max(4),
  riskFlags: z.array(z.object({
    type: z.string(), severity: z.enum(["low","medium","high"]), detail: z.string(),
  })),
  nextWeekPlan: z.array(PlannedSession),
  adjustmentsVsLastWeek: z.string(),
  coachingNote: z.string(),   // MORA sadržati fitness/wellness disclaimer, bez medicinskih tvrdnji
});
export type CoachPlan = z.infer<typeof CoachPlan>;

// JSON Schema za Anthropic tool `input_schema` (strict)
export const COACH_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment","keyObservations","riskFlags","nextWeekPlan","adjustmentsVsLastWeek","coachingNote"],
  properties: {
    assessment: {
      type: "object", additionalProperties: false,
      required: ["fitnessTrend","fatigueState","readiness"],
      properties: {
        fitnessTrend: { type: "string", enum: ["improving","stable","declining"] },
        fatigueState: { type: "string", enum: ["fresh","moderate","high"] },
        readiness: { type: "string", enum: ["ready","ready_with_caution","hold_back"] },
      },
    },
    keyObservations: { type: "array", items: { type: "string" }, maxItems: 4 },
    riskFlags: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["type","severity","detail"],
      properties: {
        type: { type: "string" },
        severity: { type: "string", enum: ["low","medium","high"] },
        detail: { type: "string" },
      },
    }},
    nextWeekPlan: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["day","type","distanceKm","target","purpose"],
      properties: {
        day: { type: "string", enum: ["mon","tue","wed","thu","fri","sat","sun"] },
        type: { type: "string", enum: ["easy","long","tempo","intervals","recovery","rest","race","cross"] },
        distanceKm: { type: ["number","null"] },
        target: { type: "string" },
        purpose: { type: "string" },
      },
    }},
    adjustmentsVsLastWeek: { type: "string" },
    coachingNote: { type: "string" },
  },
} as const;
