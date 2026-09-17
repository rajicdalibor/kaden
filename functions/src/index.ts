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
  computeSessionMetrics, buildSummaryFromMetrics, buildGoalContext, isoWeek, parseFitBuffer,
} from "@kaden/metrics";
import { generatePlan } from "./sonnet.js";
import { analyzeSession } from "./coach.js";
import { coachChat, type ChatMessage } from "./chat.js";
import { sessionToDumpText } from "./context.js";

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const REGION = "europe-west1"; // poravnaj sa Firestore lokacijom
const MEMORY_CAP = 20;

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Deterministička klasifikacija tipa treninga (za oznaku kartice). */
function classifyType(m: SessionMetrics): string {
  if (m.durMin >= 90) return "long";
  const z4 = m.zonePct[3] ?? 0, z5 = m.zonePct[4] ?? 0;
  if (z5 >= 8) return "intervals";
  if (z4 >= 30) return "tempo";
  if ((m.avgHr ?? 999) < 145) return "recovery";
  return "easy";
}

/** Verifikuj Auth token + allowlist, vrati {uid, profile} ili pošalji error i vrati null. */
async function authAndProfile(req: any, res: any): Promise<{ uid: string; profile: AthleteProfile } | null> {
  const authz = req.header("Authorization") ?? "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!idToken) { res.status(401).json({ error: "missing_auth" }); return null; }
  const uid = (await getAuth().verifyIdToken(idToken)).uid;
  if (!(await db.doc(`allowlist/${uid}`).get()).exists) {
    res.status(403).json({ error: "not_allowlisted" }); return null;
  }
  const profSnap = await db.doc(`athletes/${uid}`).get();
  if (!profSnap.exists) { res.status(400).json({ error: "no_profile" }); return null; }
  return { uid, profile: AthleteProfile.parse(profSnap.data()) };
}

/** Metrике (determinístički) + hrStream u Storage + session doc (→ okida onSessionCreated). */
async function storeSession(uid: string, raw: RawSession, profile: AthleteProfile): Promise<SessionMetrics> {
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
  return metrics;
}

/** POST /sync — telefon šalje gotovu RawSession (iz HealthKit). */
export const sync = onRequest(
  { region: REGION, cors: true, invoker: "public" },
  async (req, res) => {
    try {
      const ap = await authAndProfile(req, res);
      if (!ap) return;
      const raw = RawSession.parse(req.body);
      const metrics = await storeSession(ap.uid, raw, ap.profile);
      res.status(200).json({ ok: true, sessionId: raw.sessionId, metrics });
    } catch (e) {
      console.error("sync failed", e);
      res.status(400).json({ error: String(e) });
    }
  },
);

/** POST /syncFit — telefon šalje SIROV FIT (base64); parsiranje na serveru (isti tested parser). */
export const syncFit = onRequest(
  { region: REGION, cors: true, memory: "512MiB", invoker: "public" },
  async (req, res) => {
    try {
      const ap = await authAndProfile(req, res);
      if (!ap) return;
      const b64 = req.body?.fitBase64;
      if (typeof b64 !== "string" || b64.length === 0) {
        res.status(400).json({ error: "missing_fitBase64" }); return;
      }
      const buf = Buffer.from(b64, "base64");
      const raw = await parseFitBuffer(buf, "tmp");
      // stabilan id iz start_time-a (npr. 20260914061931)
      raw.sessionId = raw.startTime.replace(/[^0-9]/g, "").slice(0, 14) || String(Date.now());
      const metrics = await storeSession(ap.uid, raw, ap.profile);
      res.status(200).json({ ok: true, sessionId: raw.sessionId, metrics });
    } catch (e) {
      console.error("syncFit failed", e);
      res.status(400).json({ error: String(e) });
    }
  },
);

/** POST /chat — konverzacija sa trenerom (multi-turn). Telefon šalje ceo razgovor. */
export const chat = onRequest(
  { region: REGION, cors: true, invoker: "public", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 180 },
  async (req, res) => {
    try {
      const ap = await authAndProfile(req, res);
      if (!ap) return;
      const messages = req.body?.messages as ChatMessage[] | undefined;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "missing_messages" }); return;
      }
      const sessSnap = await db.collection(`athletes/${ap.uid}/sessions`)
        .orderBy("startTime", "desc").limit(12).get();
      const recentHistory = sessSnap.docs
        .map((d) => d.data().metrics as SessionMetrics)
        .filter((m): m is SessionMetrics => !!m)
        .reverse();
      const memSnap = await db.doc(`athletes/${ap.uid}/memory/current`).get();
      const memory = memSnap.exists
        ? CoachingMemory.parse(memSnap.data())
        : { observations: [], respondsWellTo: [], avoid: [] };

      const reply = await coachChat(
        messages,
        { profile: ap.profile, goalContext: buildGoalContext(ap.profile, todayISO()), recentHistory, memory },
        ANTHROPIC_API_KEY.value(),
      );
      res.status(200).json({ reply });
    } catch (e) {
      console.error("chat failed", e);
      res.status(400).json({ error: String(e) });
    }
  },
);

/** Per-workout coach: okida se na novu sesiju → SessionAnalysis + update memorije. */
export const onSessionCreated = onDocumentCreated(
  { document: "athletes/{uid}/sessions/{sessionId}", region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 180 },
  async (event) => {
    const { uid } = event.params;
    const doc = event.data?.data();
    if (!doc) return;

    // Backfill istorije: stare sesije ulaze kao kontekst (metrике), ali NE trošimo
    // LLM na analizu run-a od pre više nedelja — samo skorašnja dobijaju coach analizu.
    const ANALYZE_MAX_AGE_DAYS = 14;
    const sDate: string = doc.metrics?.date ?? String(doc.startTime ?? "").slice(0, 10);
    const ageDays = (Date.now() - Date.parse(`${sDate}T00:00:00Z`)) / 86400000;
    if (Number.isFinite(ageDays) && ageDays > ANALYZE_MAX_AGE_DAYS) {
      console.log(`onSessionCreated: preskačem analizu za staru sesiju ${sDate} (${Math.round(ageDays)}d)`);
      return;
    }
    // Bez upotrebljivog pulsa nema šta da se oceni (npr. HealthKit run bez HR uzoraka).
    if (doc.metrics?.avgHr == null || (doc.sampleCount ?? 0) === 0) {
      console.log(`onSessionCreated: preskačem analizu (nema HR) ${sDate}`);
      return;
    }

    try {
      const profile = AthleteProfile.parse((await db.doc(`athletes/${uid}`).get()).data());

      // Recent history (metrике) za coach kontekst — poređenje sa prethodnim.
      const histSnap = await db.collection(`athletes/${uid}/sessions`)
        .orderBy("startTime", "desc").limit(13).get();
      const recentHistory = histSnap.docs
        .map((d) => d.data().metrics as SessionMetrics)
        .filter((m): m is SessionMetrics => !!m)
        .filter((m) => m.date !== doc.metrics?.date)
        .slice(0, 12).reverse();

      const memSnap = await db.doc(`athletes/${uid}/memory/current`).get();
      const memory = memSnap.exists
        ? CoachingMemory.parse(memSnap.data())
        : { observations: [], respondsWellTo: [], avoid: [] };

      // Rekonstruiši "Garmin dump" iz izvučenih podataka (laps, zone, HR, TE, Load) +
      // opcioni subjektivni unos → BOGATA slobodna analiza (kao chat), automatski.
      const dump = sessionToDumpText(doc, profile);
      const subjective = typeof doc.subjective === "string" && doc.subjective.trim()
        ? `\n\nSubjektivno (kako se osećam): ${doc.subjective.trim()}` : "";
      const narrative = await coachChat(
        [{ role: "user", content: `${dump}${subjective}\n\nUradi analizu ovog treninga.` }],
        { profile, goalContext: buildGoalContext(profile, todayISO()), recentHistory, memory },
        ANTHROPIC_API_KEY.value(),
      );

      await db.doc(`athletes/${uid}/analyses/${doc.sessionId}`).set({
        date: doc.metrics.date,
        classification: classifyType(doc.metrics),
        narrative,
        createdAt: FieldValue.serverTimestamp(),
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
