# Firestore data model — Kaden

Sve po korisniku (`uid`). Cloud Functions (admin SDK) pišu; korisnik čita svoje + unosi check-in.
Veliki podaci (hrStream, laps) NE idu u Firestore doc → Cloud Storage.

```
allowlist/{uid}                      # personal edition gate (postoji = dozvoljen)
athletes/{uid}                       # AthleteProfile (Zod: AthleteProfile)
  sessions/{sessionId}               # RawSession BEZ hrStream/laps + computed SessionMetrics
  analyses/{sessionId}               # SessionAnalysis (per-workout coach izlaz)
  plans/{isoWeek}                    # CoachPlan (nedeljni)
  checkins/{isoWeek}                 # WeeklyCheckIn (korisnički subjektivni input)
  memory/current                     # CoachingMemory (jedan doc, LLM ga ažurira)
```

Cloud Storage:
```
athletes/{uid}/streams/{sessionId}.json   # { hrStream: HrSample[], laps: Lap[] }
```

## Tok podataka
1. **sync** (onRequest): telefon šalje RawSession (iz HealthKit/FIT) → verifikuj Auth+App Check
   → hrStream/laps u Storage, ostatak + `computeSessionMetrics` u `sessions/{id}`
   → (opciono odmah) `analyzeSession` → `analyses/{id}`, `mergeMemory` → `memory/current`.
2. **weeklyAnalysis** (scheduler, pon 06:00): za svaki allowlist uid → `buildMetricsSummary`
   + `buildGoalContext` → `generatePlan` → `plans/{isoWeek}`.

## Ugovori (shared-types)
AthleteProfile · RawSession · SessionMetrics · WeeklyMetrics · MetricsSummary ·
CoachPlan · SessionAnalysis · WeeklyCheckIn · CoachingMemory · GoalContext · CurrentForm.
