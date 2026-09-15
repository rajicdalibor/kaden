/**
 * Gurni jednu FIT-derived sesiju u produkciju (admin write) → deployed
 * `onSessionCreated` trigger napravi analizu.
 *   UID=<uid> pnpm --filter @kaden/functions push [putanja-do-session.json]
 * Default: Sep 14 recovery. Traži ADC (gcloud auth application-default login).
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { AthleteProfile, RawSession } from "@kaden/shared-types";
import { computeSessionMetrics } from "@kaden/metrics";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const uid = process.env.UID;
if (!uid) { console.error("✗ Postavi UID=<firebase-uid>"); process.exit(1); }

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const file = process.argv[2] ?? join(repoRoot, "packages/metrics/fixtures-fit/24360297055.json");

initializeApp({ projectId: "kaden-7b907", credential: applicationDefault() });
const db = getFirestore();

const profSnap = await db.doc(`athletes/${uid}`).get();
if (!profSnap.exists) { console.error(`✗ Nema athletes/${uid} — prvo pokreni seed`); process.exit(1); }
const profile = AthleteProfile.parse(profSnap.data());

const raw = RawSession.parse(JSON.parse(readFileSync(file, "utf8")));
const metrics = computeSessionMetrics(raw, profile);
const { hrStream, ...rest } = raw; // hrStream ne treba za analizu (metrics već izračunat)
void hrStream;

await db.doc(`athletes/${uid}/sessions/${raw.sessionId}`)
  .set({ ...rest, metrics, createdAt: FieldValue.serverTimestamp() });

console.log(`✓ Upisana sesija athletes/${uid}/sessions/${raw.sessionId} (${metrics.date}, ${metrics.distKm}km)`);
console.log("→ onSessionCreated trigger pravi analizu (par sekundi). Gledaj app / analyses kolekciju.");
process.exit(0);
