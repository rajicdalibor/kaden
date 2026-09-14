import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { generatePlan } from "./sonnet.js";
import type { MetricsSummary } from "@kaden/shared-types";

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const REGION = "europe-west1";

/** POST /sync - telefon šalje nove sesije iz HealthKit/Health Connect. */
export const sync = onRequest(
  { region: REGION, cors: true /* TODO: App Check enforce */ },
  async (req, res) => {
    // TODO: verifikuj Firebase Auth token + App Check, upiši u sessions/{uid}/items,
    //       hrStream u Cloud Storage, izračunaj metrike (@kaden/metrics).
    res.status(501).json({ todo: "implement sync" });
  },
);

/** Nedeljna analiza - Scheduler okine, fan-out po korisniku. */
export const weeklyAnalysis = onSchedule(
  { schedule: "every monday 06:00", timeZone: "Europe/Belgrade",
    region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300 },
  async () => {
    const users = await db.collection("allowlist").get();
    for (const u of users.docs) {
      const uid = u.id;
      // TODO: sastavi MetricsSummary iz weeklyMetrics + recentSessions
      const summary = {} as MetricsSummary;
      try {
        const plan = await generatePlan(summary, ANTHROPIC_API_KEY.value());
        await db.collection(`analyses/${uid}/items`).add({
          createdAt: Date.now(), ...plan,
        });
      } catch (e) {
        console.error(`analysis failed for ${uid}`, e);
      }
    }
  },
);
