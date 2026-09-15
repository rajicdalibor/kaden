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
});

await db.doc(`allowlist/${uid}`).set({ addedAt: FieldValue.serverTimestamp() });
await db.doc(`athletes/${uid}`).set(profile, { merge: true });
console.log(`✓ Seed gotov za uid=${uid} ${emulator ? "(emulator)" : "(PRODUKCIJA)"}`);
console.log(`  allowlist/${uid} + athletes/${uid} (HRmax 191, LTHR 169, cilj Zagreb 11.10)`);
process.exit(0);
