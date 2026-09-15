/**
 * E2E smoke test protiv Firebase EMULATORA (bez deploy-a, bez prod podataka).
 * Pokreni pošto su emulatori gore:
 *   firebase emulators:start --only auth,functions,firestore,storage --project kaden-7b907
 *   pnpm --filter @kaden/functions smoke
 * Validira: sync (auth+allowlist+metrике+upis) → onSessionCreated trigger → SessionAnalysis.
 */
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8088";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9098";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { AthleteProfile } from "@kaden/shared-types";

const PROJECT = "kaden-7b907";
const uid = "dev-dalibor";
initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();

// 1) Seed allowlist + profil
const profile = AthleteProfile.parse({
  uid, sex: "male", birthYear: 1983, hrMax: 191, hrRest: 49, lthr: 169,
  zoneModel: "lactate",
  goal: { race: "half_marathon", dateISO: "2026-10-11", targetTimeMin: 120 },
  notes: "recovery <145, long 140-152, tempo 155-169, intervali 167-176, siva zona 150-160.",
});
await db.doc(`allowlist/${uid}`).set({ addedAt: FieldValue.serverTimestamp() });
await db.doc(`athletes/${uid}`).set(profile, { merge: true });
try { await auth.createUser({ uid }); } catch { /* postoji */ }
console.log("✓ seed + user");

// 2) idToken preko auth emulatora
const customToken = await auth.createCustomToken(uid);
const exch = await fetch(
  `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
);
const idToken = (await exch.json() as any).idToken;
if (!idToken) { console.error("✗ nema idToken", await exch.text?.()); process.exit(1); }
console.log("✓ idToken");

// 3) POST /sync sa fixture sesijom
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const raw = JSON.parse(readFileSync(join(repoRoot, "packages/metrics/fixtures-fit/24360297055.json"), "utf8"));
const syncUrl = `http://127.0.0.1:5011/${PROJECT}/europe-west1/sync`;
const resp = await fetch(syncUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
  body: JSON.stringify(raw),
});
console.log(`sync → ${resp.status}:`, JSON.stringify(await resp.json()));

// 4) Čekaj da trigger upiše analizu
console.log("čekam onSessionCreated → analizu...");
for (let i = 0; i < 40; i++) {
  const a = await db.doc(`athletes/${uid}/analyses/${raw.sessionId}`).get();
  if (a.exists) {
    const d = a.data()!;
    console.log(`\n✓ ANALIZA [${d.classification}] verdikt: ${d.verdict}`);
    console.log("assessment:", d.assessment);
    const mem = await db.doc(`athletes/${uid}/memory/current`).get();
    console.log("memorija:", (mem.data()?.observations ?? []).length, "zapažanja");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
console.error("✗ analiza nije upisana u roku (proveri secret/emulator log)");
process.exit(1);
