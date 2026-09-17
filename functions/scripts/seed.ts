/**
 * Seed allowlist + athlete profil (personal edition).
 *   UID=<firebase-uid> pnpm --filter @kaden/functions seed            # produkcija (ADC)
 *   UID=dev FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm ... seed      # emulator
 *
 * UID dobijaš iz Firebase Auth posle prve Google prijave (ili iz emulatora).
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { AthleteProfile } from "@kaden/shared-types";

const uid = process.env.UID;
if (!uid) { console.error("✗ Postavi UID=<firebase-uid>"); process.exit(1); }

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
initializeApp(emulator
  ? { projectId: "kaden-7b907" }
  : { projectId: "kaden-7b907", credential: applicationDefault() });
const db = getFirestore();

const profile = AthleteProfile.parse({
  uid,
  sex: "male",
  birthYear: 1983,          // 43 god (2026)
  hrMax: 191, hrRest: 49, lthr: 169,
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120, priority: "A" },
  availability: { daysPerWeek: 5, preferredDays: [], longRunDay: "sat" },
  notes: "recovery <145, long 140-152, tempo 155-169, intervali 167-176, siva zona 150-160. Kadenca cilj 164-167.",
  coachContext: `PROFIL: Muškarac, 43g, 190cm, ~91-93kg (nekad 115+, cilj 88kg). Garmin Fenix 7 Pro.
Max HR 191, LTHR 169 (u satu 167), Rest HR 49, VO2max ~46 (Good/Increasing). Recovery HR posle treninga 25-40 bpm.

TRKE: Belgrade Business Run 5km (24.9) — tune-up, oštro. Zagreb polumaraton 11.10 = GLAVNI CILJ, sub-2h (ciljni pace 5:41/km); forma realno sub-2h sa baferom (1:50-1:55). Opcioni 5km ~4.10 lagano/preskočiti; pun HM 7 dana pre — preskače (rizik).

STRUKTURA (80/20 polarizovano): Pon recovery 40-50min HR<145; Uto teretana; Sre tempo (2×15-20min) ILI intervali 800m NAIZMENIČNO; Pet/sub long. Kvalitet i dugi UJUTRU (hladnije, čistiji podaci), lagani može uveče.

ZONE (po LTHR 169): recovery <145; long 140-152 (idealno <150); tempo 155-169 (Z4); intervali 167-176; SIVA ZONA 150-160 (izbegavati na easy danima). Kadenca cilj 164-167 spm.

NUTRICIJA: 2 whey shake-a/dan, protein cilj 140-160g/dan. Kalorije dan treninga 2200-2300, bez 1800-1900, nikad <1700. Deficit 300-400 kcal (Garmin precenjuje potrošnju 15-20%). Vikend (roštilj/vino/kokice) briše nedeljni deficit → težina stagnira. Suplementi whey+magnezijum, dodati Omega 3. Za jutarnji dugi/intervale nešto malo (banana, kafa) 20-30min pre — NE fasted na velike treninge.

ZDRAVLJE: šilo u boku na tempu po vrućini; blagi GI bol na intervalima (druga polovina, bezopasno — obrok 3h pre, manje vlakana/masti, trbušno disanje); grčevi po vrućini → elektroliti obavezni; padel subotom → povremeno upala gluteusa (oprez posle velikih treninga). SAN 7-8h je najveća neiskorišćena poluga (obara Training Readiness).

TRENDOVI: aerobna efikasnost raste (long 18km @6:54 uz HR 142 vs julski 148; recovery 6:42 @137). Tempo 5:23-5:27 komotno, max 166-168 (ispod praga) → velik bafer iznad HM tempa 5:41. Intervali 8×800 ~4:58, max 176. Kadenca prirodno 154→164-167 (ako padne na 154, par striders). OBRAZAC: zna da "povuče" easy u tempo kad se oseća dobro — drži ga disciplinovanim na laganim danima.`,
});

await db.doc(`allowlist/${uid}`).set({ addedAt: FieldValue.serverTimestamp() });
await db.doc(`athletes/${uid}`).set(profile, { merge: true });
console.log(`✓ Seed gotov za uid=${uid} ${emulator ? "(emulator)" : "(PRODUKCIJA)"}`);
console.log(`  allowlist/${uid} + athletes/${uid} (HRmax 191, LTHR 169, cilj Zagreb 11.10)`);
process.exit(0);
