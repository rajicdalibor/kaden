# Kaden — projektni kontekst za Claude Code

AI trener trčanja. Garmin sat kao hardver, deterministički proračuni + Claude Sonnet
kao mozak. **Personal edition** (ja + par ljudi, hardkodovani korisnici), ali
arhitektura mora moći da naraste u komercijalni App Store proizvod sa pretplatom.

## Zlatna pravila (ne krši ih)
1. **LLM NIKAD ne računa brojeve.** Sve metrike (TRIMP, zone, CTL/ATL/TSB, ACWR,
   decoupling, VDOT) su deterministički TypeScript u `packages/metrics`, sa unit
   testovima. Sonnet dobija gotove brojeve i samo interpretira + pravi plan.
2. **`packages/shared-types` je jedini izvor istine.** Svaki oblik podataka koji
   prelazi granicu (mobile↔functions, backend↔LLM) definisan je tamo kao Zod šema.
   Menja se SAMO preko `architect` agenta. Ne dupliraj tipove.
3. **Sonnet izlaz se uvek validira Zod-om** (`CoachPlan.parse`) pre upisa. Nikad ne
   veruj sirovom LLM JSON-u.
4. **Nema tajni u kodu.** Anthropic ključ: `.env` lokalno (u `.gitignore`),
   Secret Manager u produkciji. Nikad committed.
5. **Safety u promptu:** samo fitness/wellness, bez medicinskih dijagnoza/tvrdnji,
   disclaimer u `coachingNote`.
6. **Health podaci (guideline 5.1.3):** nikad PHI u iCloud, samo za direktnu korist
   korisnika. Fixture fajlovi sadrže realne trening podatke — repo ostaje privatan.

## Zašto ova arhitektura (kontekst odluka)
- **Garmin GCDP (cloud API) je pauziran** za nove partnere; **Strava** zabranjuje AI
  upotrebu podataka. Jedini otvoren put je **HealthKit (iOS) / Health Connect (Android)**
  + ručni **FIT import**. Garmin-native metrike (Body Battery, Training Load, Training
  Effect) NE prolaze kroz HealthKit/Health Connect — backend računa svoje ekvivalente.
  FIT fajlovi (kao fixture-i) ih sadrže i to je Faza-2 put do njih.
- **Google stack svuda:** Firebase Auth, Firestore, Cloud Functions 2nd gen (Node 22),
  Cloud Scheduler. Mobile: Expo (dev build, NE Expo Go).

## Struktura
    packages/shared-types   # Zod ugovori + JSON schema za Sonnet  [architect]
    packages/metrics        # deterministički proračuni + testovi   [metrics]
    packages/metrics/fixtures  # 3 realna trčanja (07/09/11 sep 2026)
    functions               # Cloud Functions: sync + weeklyAnalysis + sonnet.ts  [backend, ai-prompt]
    apps/mobile             # Expo app — FAZA 2, još ne kreće        [mobile]
    .claude/agents          # sub-agenti

## Komande
    pnpm install
    pnpm --filter @kaden/metrics demo    # engine na realnim fixture-ima
    pnpm --filter @kaden/metrics test     # unit testovi
    pnpm --filter @kaden/functions build  # provera backend build-a

## ⚠️ PRVO PODESI PROFIL
`packages/metrics/src/run-fixtures.ts` koristi PLACEHOLDER `HRmax=180, HRrest=50`.
Na realnim podacima to gura lagani run u Z3/Z4 — HRmax je verovatno viši (~178-182,
video max 177 na intervalima). Unesi tačne vrednosti pre nego što veruješ zonama/TRIMP-u.

## Gde smo (status)
- [x] Faza 0/1 skelet: shared-types, metrics engine (validiran, TS==Python paritet), functions stub
- [ ] **SLEDEĆE:** MetricsSummary builder (iz N sesija → rolling weekly + recent + flags)
- [ ] Sonnet poziv na realnom summary-ju + poređenje sa ručnom analizom  ← presudni test
- [ ] Ako plan drži → Faza 2 (mobile). Ako ne → doradi prompt/eval.

## Redosled delegiranja agenata
1. **architect** — fiksira/menja `shared-types` PRVO (blokira sve ostalo).
2. Paralelno: **metrics** (proračuni+testovi) ∥ **backend** (functions, rules, scheduler)
   ∥ **ai-prompt** (system prompt, tool šema, eval protiv ručnih analiza).
3. **mobile** — kreće tek kad je sync ugovor definisan i Faza 1 validirana.
4. **devops** — EAS/TestFlight, App Check, budget alert + kill-switch, Secret Manager.
5. **qa** — e2e (Maestro) + contract testovi protiv shared-types. Nema pravo pisanja u src.

Verifikacija po agentu: metrics → `test` zelen na fixture-ima; ai-prompt → izlaz validan
po `CoachPlan` + eval poklapanje; backend → build + emulator; mobile/qa → Maestro flow
sync→dashboard.

## Trenutni fokus za ovu sesiju
Sastavi `MetricsSummary` iz 3 fixture sesije i pozovi Sonnet (`functions/src/sonnet.ts`).
Cilj: dobiti plan za sledeću nedelju i uporediti ga sa ručnom procenom. Ovo je test
vrednosti celog proizvoda — sve pre mobilnog dela je jeftino baciti, sve posle skupo.
