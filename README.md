# Kaden — AI trener trčanja (personal edition)

Garmin sat → HealthKit/Health Connect (+ FIT import) → deterministički proračuni →
Claude Sonnet → nedeljni plan. Monorepo, Google stack, iOS prvo preko TestFlight.

## Zašto ovakva arhitektura
- **GCDP (Garmin cloud API) je pauziran** za nove partnere; **Strava** zabranjuje AI upotrebu.
  Jedini otvoren put je HealthKit/Health Connect + ručni FIT import.
- **LLM ne računa brojeve.** Sve metrike su determinističke i testabilne; Sonnet samo
  interpretira i pravi plan.

## Struktura
    packages/shared-types   # Zod ugovori + JSON schema (jedini izvor istine)
    packages/metrics        # TRIMP, zone, CTL/ATL/TSB, ACWR, decoupling + testovi
    packages/metrics/fixtures  # 3 realna trčanja (07/09/11 sep 2026)
    functions               # Cloud Functions (Node 22): sync + weekly analysis + Sonnet
    apps/mobile             # Expo app (Faza 2)
    .claude/agents          # sub-agenti za Claude Code

## Brzi start (Faza 1 — bez cloud-a)
    pnpm install
    pnpm --filter @kaden/metrics demo   # pokreni engine na realnim fixture-ima
    pnpm --filter @kaden/metrics test    # unit testovi

## ⚠️ PRVO PODESI PROFIL
`packages/metrics/src/run-fixtures.ts` koristi PLACEHOLDER `HRmax=180, HRrest=50`.
Na tvojim podacima to gura lagani run u Z3/Z4 — verovatno ti je HRmax viši.
Unesi svoj realni HRmax/HRrest pre nego što veruješ zonama i TRIMP-u.

## Fazni plan
- **Faza 0 — setup:** Firebase+Blaze (budget alert + kill-switch!), GCP API-ji, Apple nalog, EAS. ~2–3 dana
- **Faza 1 — jezgro (SI OVDE):** shared-types, metrics engine + testovi, Sonnet poziv.
  **Validiraj plan na svojim podacima pre UI-ja.** ~8–12 dana
- **Faza 2 — mobile:** HealthKit read + sync, Dashboard, prvi TestFlight build. ~8–10 dana
- **Faza 3 — hardening:** background sync, App Check, Crashlytics, Android/Health Connect. ~5–7 dana
- **Faza 4 — komercijalno (opciono):** Auth, RevenueCat, App Review, FIT import, Connect IQ, GCDP prijava. ~10–15+ dana

## Agenti (Claude Code)
architect → (backend ∥ metrics ∥ ai-prompt) → mobile → devops → qa.
Architect prvo fiksira shared-types (blokira sve ostalo). Detalji u `.claude/agents/`.

## Sledeći korak
1. `pnpm install && pnpm --filter @kaden/metrics demo` — vidi svoje brojeve.
2. Unesi realni HRmax/HRrest.
3. Pokreni Sonnet poziv (`functions/src/sonnet.ts`) sa MetricsSummary sastavljenim
   iz ove 3 sesije i uporedi plan sa onim što bi sam napisao.
4. Ako plan drži → Faza 2. Ako ne → doradi prompt/eval pre mobilnog dela.
