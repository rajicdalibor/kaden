import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import {
  RawSession, AthleteProfile, CoachingMemory, type SessionMetrics,
} from "@kaden/shared-types";
import {
  computeSessionMetrics, buildSummaryFromMetrics, buildGoalContext, isoWeek,
} from "@kaden/metrics";
import { generatePlan } from "./sonnet.js";
import { analyzeSession } from "./coach.js";
import { enrichFromDoc, lapsFromDoc, assembleContext } from "./context.js";

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const REGION = "europe-west1"; // poravnaj sa Firestore lokacijom
const MEMORY_CAP = 20;

const todayISO = () => new Date().toISOString().slice(0, 10);

/** POST /sync — telefon šalje jednu RawSession (iz HealthKit/FIT). */
export const sync = onRequest(
  { region: REGION, cors: true },
  async (req, res) => {
    try {
      // 1) Auth (Firebase ID token). TODO: App Check enforce (X-Firebase-AppCheck).
      const authz = req.header("Authorization") ?? "";
      const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
      if (!idToken) { res.status(401).json({ error: "missing_auth" }); return; }
      const uid = (await getAuth().verifyIdToken(idToken)).uid;

      // 2) Allowlist gate (personal edition).
      if (!(await db.doc(`allowlist/${uid}`).get()).exists) {
        res.status(403).json({ error: "not_allowlisted" }); return;
      }

      // 3) Validacija + profil.
      const raw = RawSession.parse(req.body);
      const profSnap = await db.doc(`athletes/${uid}`).get();
      if (!profSnap.exists) { res.status(400).json({ error: "no_profile" }); return; }
      const profile = AthleteProfile.parse(profSnap.data());

      // 4) Metrике (determinístički) + čuvanje.
      const metrics = computeSessionMetrics(raw, profile);
      try {
        await getStorage().bucket()
          .file(`athletes/${uid}/streams/${raw.sessionId}.json`)
          .save(JSON.stringify({ hrStream: raw.hrStream }), { contentType: "application/json" });
      } catch (e) {
        console.warn(`stream upload failed (${uid}/${raw.sessionId}) — nastavljam`, e);
      }

      const { hrStream, ...rest } = raw; // hrStream u Storage; laps ostaju u doc-u (mali)
      void hrStream;
      await db.doc(`athletes/${uid}/sessions/${raw.sessionId}`)
        .set({ ...rest, metrics, createdAt: FieldValue.serverTimestamp() });

      res.status(200).json({ ok: true, sessionId: raw.sessionId, metrics });
    } catch (e) {
      console.error("sync failed", e);
      res.status(400).json({ error: String(e) });
    }
  },
);

/** Per-workout coach: okida se na novu sesiju → SessionAnalysis + update memorije. */
export const onSessionCreated = onDocumentCreated(
  { document: "athletes/{uid}/sessions/{sessionId}", region: REGION, secrets: [ANTHROPIC_API_KEY] },
  async (event) => {
    const { uid } = event.params;
    const doc = event.data?.data();
    if (!doc) return;
    try {
      const profile = AthleteProfile.parse((await db.doc(`athletes/${uid}`).get()).data());

      // Istorija: poslednjih 8 sesija pre ove (za poređenje).
      const histSnap = await db.collection(`athletes/${uid}/sessions`)
        .orderBy("startTime", "desc").limit(9).get();
      const history = histSnap.docs
        .map((d) => d.data())
        .filter((d) => d.sessionId !== doc.sessionId)
        .slice(0, 8)
        .map(enrichFromDoc);

      // Memorija.
      const memSnap = await db.doc(`athletes/${uid}/memory/current`).get();
      const memory = memSnap.exists
        ? CoachingMemory.parse(memSnap.data())
        : { observations: [], respondsWellTo: [], avoid: [] };

      const context = assembleContext({
        profile,
        focus: enrichFromDoc(doc),
        focusLaps: lapsFromDoc(doc),
        history,
        goalContext: buildGoalContext(profile, todayISO()),
        memory,
        // TODO: intent iz plans/{isoWeek} matchovan po danu; + checkins subjective.
      });

      const analysis = await analyzeSession(context, ANTHROPIC_API_KEY.value());
      await db.doc(`athletes/${uid}/analyses/${doc.sessionId}`)
        .set({ ...analysis, createdAt: FieldValue.serverTimestamp() });

      // Merge memoryUpdate → memory/current (dedup, cap).
      const observations = [...memory.observations];
      for (const o of analysis.memoryUpdate) if (!observations.includes(o)) observations.push(o);
      await db.doc(`athletes/${uid}/memory/current`).set({
        ...memory,
        observations: observations.slice(-MEMORY_CAP),
        updatedAtISO: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`onSessionCreated failed ${uid}/${doc.sessionId}`, e);
    }
  },
);

/** Nedeljna analiza — scheduler, fan-out po allowlist korisniku. */
export const weeklyAnalysis = onSchedule(
  {
    schedule: "every monday 06:00", timeZone: "Europe/Belgrade",
    region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300,
  },
  async () => {
    const users = await db.collection("allowlist").get();
    for (const u of users.docs) {
      const uid = u.id;
      try {
        const profSnap = await db.doc(`athletes/${uid}`).get();
        if (!profSnap.exists) continue;
        const profile = AthleteProfile.parse(profSnap.data());

        const sessSnap = await db.collection(`athletes/${uid}/sessions`).get();
        const metrics = sessSnap.docs
          .map((d) => d.data().metrics as SessionMetrics)
          .filter((m): m is SessionMetrics => !!m);
        if (metrics.length === 0) continue;

        const today = todayISO();
        const summary = buildSummaryFromMetrics(metrics, profile, { asOf: today });
        summary.goalContext = buildGoalContext(profile, today) ?? undefined;
        const memSnap = await db.doc(`athletes/${uid}/memory/current`).get();
        if (memSnap.exists) summary.coachingMemory = CoachingMemory.parse(memSnap.data());

        const plan = await generatePlan(summary, ANTHROPIC_API_KEY.value());
        await db.doc(`athletes/${uid}/plans/${isoWeek(today)}`)
          .set({ ...plan, createdAt: FieldValue.serverTimestamp() });
      } catch (e) {
        console.error(`weeklyAnalysis failed for ${uid}`, e);
      }
    }
  },
);
