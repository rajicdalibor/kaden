import { z } from "zod";

/**
 * SHARED CONTRACTS — jedini izvor istine za oblik podataka.
 * Deljeno između /functions (backend) i /apps/mobile (Expo).
 * Vlasnik: Architect/Lead agent. Menjati SAMO ovde.
 */

// ---------- Zajednički enumi ----------
export const HrZoneModel = z.enum(["pct_hrmax", "pct_hrr", "lactate"]);
export const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const RaceType = z.enum(["5k", "10k", "half_marathon", "marathon", "ultra", "general"]);

// ---------- Cilj (strukturirano — pokreće determinističku periodizaciju) ----------
export const Goal = z.object({
  race: RaceType,
  dateISO: z.string().optional(),          // datum trke; napaja weeksToRace + fazu
  targetTimeMin: z.number().positive().optional(),
  priority: z.enum(["A", "B", "C"]).default("A"),
});
export type Goal = z.infer<typeof Goal>;

// ---------- Povrede (strukturirano jezgro + slobodna beleška) ----------
export const BodyArea = z.enum([
  "foot", "ankle", "achilles", "calf", "shin", "knee", "hamstring",
  "quad", "hip", "glute", "itb", "lower_back", "other",
]);
export const Injury = z.object({
  area: BodyArea,
  status: z.enum(["active", "recovering", "healed"]),
  sinceISO: z.string().optional(),
  note: z.string().optional(),             // nijansa: "bol na nizbrdici posle 15km"
});
export type Injury = z.infer<typeof Injury>;

// ---------- Athlete profile ----------
export const AthleteProfile = z.object({
  uid: z.string(),
  birthYear: z.number().int().optional(),
  sex: z.enum(["male", "female"]).default("male"),
  weightKg: z.number().positive().optional(),
  hrMax: z.number().int().positive(),        // MORA biti tačan - diktira zone + TRIMP
  hrRest: z.number().int().positive(),
  lthr: z.number().int().positive().optional(), // laktatni prag HR — osnov za "lactate" zone
  zoneModel: HrZoneModel.default("pct_hrmax"),
  vdot: z.number().positive().optional(),
  goal: Goal.optional(),
  // Dostupnost (strukturirano — pokreće raspored plana):
  availability: z.object({
    daysPerWeek: z.number().int().min(1).max(7).default(4),
    preferredDays: z.array(Weekday).default([]),
    longRunDay: Weekday.optional(),
    maxSessionsPerWeek: z.number().int().min(1).max(14).optional(),
  }).default({ daysPerWeek: 4, preferredDays: [] }),
  injuries: z.array(Injury).default([]),
  constraints: z.array(z.string()).default([]),
  notes: z.string().optional(),              // slobodno: "šta trener treba da zna"
});
export type AthleteProfile = z.infer<typeof AthleteProfile>;

// ---------- Raw session (posle parsiranja FIT / HealthKit) ----------
export const HrSample = z.object({
  t: z.string(),                  // ISO timestamp
  hr: z.number().int().nullable(),
  spd: z.number().nonnegative(),  // m/s
});
export type HrSample = z.infer<typeof HrSample>;

export const Lap = z.object({
  distanceM: z.number(),
  durationSec: z.number(),
  avgHr: z.number().int().nullable(),
  maxHr: z.number().int().nullable(),
  avgSpeed: z.number().nullable(),   // m/s
});
export type Lap = z.infer<typeof Lap>;

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
  laps: z.array(Lap).default([]),  // per-lap splits (iz FIT-a); prazno iz HealthKit-a
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

// ---------- Trenutna forma NA dan planiranja (deterministički, ne LLM) ----------
export const CurrentForm = z.object({
  asOf: z.string(),                          // dan planiranja "YYYY-MM-DD"
  ctl: z.number(),
  atl: z.number(),
  tsb: z.number(),
  daysSinceLastRun: z.number().int(),
});
export type CurrentForm = z.infer<typeof CurrentForm>;

// ---------- Kontekst cilja (deterministička periodizacija) ----------
export const TrainingPhase = z.enum(["base", "build", "peak", "taper", "race_week", "none"]);
export const GoalContext = z.object({
  race: RaceType,
  dateISO: z.string().optional(),
  weeksToRace: z.number().nullable(),        // null ako nema datuma
  phase: TrainingPhase,
  targetPaceSecPerKm: z.number().nullable(), // ciljni trkački tempo (iz cilja)
  requiredVdot: z.number().nullable(),       // VDOT potreban za cilj (deterministički)
});
export type GoalContext = z.infer<typeof GoalContext>;

// ---------- Nedeljni subjektivni check-in (korisnički input) ----------
export const WeeklyCheckIn = z.object({
  weekOf: z.string(),                        // ISO datum ili "YYYY-Www"
  perceivedEffort: z.number().min(1).max(10).optional(),  // RPE prošle nedelje
  sleep: z.number().min(1).max(5).optional(),
  soreness: z.number().min(1).max(5).optional(),
  motivation: z.number().min(1).max(5).optional(),
  niggles: z.string().optional(),            // slobodno: sitne tegobe
  notes: z.string().optional(),
});
export type WeeklyCheckIn = z.infer<typeof WeeklyCheckIn>;

// ---------- Trenerska memorija (LLM je čita I ažurira kroz nedelje) ----------
export const CoachingMemory = z.object({
  observations: z.array(z.string()).default([]),  // "preteruje posle nedelje odmora (W30/W32)"
  respondsWellTo: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  updatedAtISO: z.string().optional(),
});
export type CoachingMemory = z.infer<typeof CoachingMemory>;

// ---------- Adherence: plan vs. stvarno odrađeno ----------
export const PlanAdherence = z.object({
  weekOf: z.string(),
  plannedKm: z.number(),
  actualKm: z.number(),
  adherencePct: z.number().nullable(),
  deviations: z.array(z.string()).default([]),   // "traženo 8km lagano, odrađeno 12km tempo"
});
export type PlanAdherence = z.infer<typeof PlanAdherence>;

// ---------- LLM input summary ----------
export const MetricsSummary = z.object({
  athlete: AthleteProfile,
  rollingWeeks: z.array(WeeklyMetrics),
  recentSessions: z.array(SessionMetrics),
  flags: z.array(z.string()),
  // Dodatni kontekst za personalizaciju (sve opciono — bekvard-kompatibilno):
  currentForm: CurrentForm.optional(),
  goalContext: GoalContext.optional(),
  checkIn: WeeklyCheckIn.optional(),
  coachingMemory: CoachingMemory.optional(),
  adherence: PlanAdherence.optional(),
});
export type MetricsSummary = z.infer<typeof MetricsSummary>;

// ---------- LLM output (nametnuto preko tool use / structured output) ----------
export const SessionType = z.enum([
  "easy", "long", "tempo", "intervals", "recovery", "rest", "race", "cross",
]);
export const PlannedSession = z.object({
  day: Weekday,
  type: SessionType,
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
  // Personalizacija:
  clarifyingQuestions: z.array(z.string()).max(3).default([]),  // pita kad su podaci dvosmisleni
  memoryUpdate: z.array(z.string()).max(5).default([]),         // upiši u CoachingMemory.observations
});
export type CoachPlan = z.infer<typeof CoachPlan>;

// JSON Schema za Anthropic tool `input_schema` (strict)
export const COACH_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assessment","keyObservations","riskFlags","nextWeekPlan","adjustmentsVsLastWeek","coachingNote","clarifyingQuestions","memoryUpdate"],
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
    clarifyingQuestions: { type: "array", items: { type: "string" }, maxItems: 3 },
    memoryUpdate: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
} as const;

// ---------- Per-workout analiza (SRCE app-a — reprodukuje chat coach) ----------
// Fiksna struktura: osnovni brojevi → zone → iskrena ocena → poređenje → sledeći
// korak → subjektivno pitanje. App renderuje sekcije u chat-like prikaz.
export const SessionVerdict = z.enum(["excellent", "on_track", "watch", "back_off"]);
export const SessionAnalysis = z.object({
  sessionId: z.string(),
  date: z.string(),
  classification: SessionType,          // trenerova klasifikacija treninga
  verdict: SessionVerdict,              // strukturiran signal za UI/logiku
  basics: z.string(),                   // osnovni brojevi (sažeto)
  zones: z.string(),                    // zonska ocena (po korisnikovom modelu)
  assessment: z.string(),               // iskrena ocena
  comparisons: z.array(z.string()).max(5),   // poređenja sa NJEGOVOM istorijom
  nextStep: z.string(),                 // konkretan sledeći korak
  question: z.string(),                 // subjektivno pitanje (UVEK)
  coachingNote: z.string(),             // fitness/wellness disclaimer, bez medicinskih tvrdnji
  memoryUpdate: z.array(z.string()).max(5).default([]),  // upis u CoachingMemory
});
export type SessionAnalysis = z.infer<typeof SessionAnalysis>;

export const SESSION_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "sessionId", "date", "classification", "verdict", "basics", "zones",
    "assessment", "comparisons", "nextStep", "question", "coachingNote", "memoryUpdate",
  ],
  properties: {
    sessionId: { type: "string" },
    date: { type: "string" },
    classification: {
      type: "string",
      enum: ["easy", "long", "tempo", "intervals", "recovery", "rest", "race", "cross"],
    },
    verdict: { type: "string", enum: ["excellent", "on_track", "watch", "back_off"] },
    basics: { type: "string" },
    zones: { type: "string" },
    assessment: { type: "string" },
    comparisons: { type: "array", items: { type: "string" }, maxItems: 5 },
    nextStep: { type: "string" },
    question: { type: "string" },
    coachingNote: { type: "string" },
    memoryUpdate: { type: "array", items: { type: "string" }, maxItems: 5 },
  },
} as const;
