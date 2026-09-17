import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { AthleteProfile, CoachingMemory, type SessionMetrics } from "@kaden/shared-types";
import { buildGoalContext } from "@kaden/metrics";
import { coachChat } from "../src/chat.js";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
try { process.loadEnvFile(join(repoRoot, ".env")); } catch { /* env */ }
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) { console.error("nema ANTHROPIC_API_KEY"); process.exit(1); }

initializeApp({ projectId: "kaden-7b907", credential: applicationDefault() });
const db = getFirestore();
const uid = "EB6PG0D2I0fQ3wX4UDXVGGXpdZx2";
const profile = AthleteProfile.parse((await db.doc(`athletes/${uid}`).get()).data());
const sess = await db.collection(`athletes/${uid}/sessions`).orderBy("startTime", "desc").limit(12).get();
const recentHistory = sess.docs.map((d) => d.data().metrics as SessionMetrics).filter(Boolean).reverse();
const memSnap = await db.doc(`athletes/${uid}/memory/current`).get();
const memory = memSnap.exists ? CoachingMemory.parse(memSnap.data()) : { observations: [], respondsWellTo: [], avoid: [] };

const msg = `Danas je petak. Radio jutros rano long, po dogovoru. Slabije sam spavao, Training Readiness je bio LOW, osećao i umor od intervala od srede popodne (manje od dva dana). Ali uspeo da izguram sve po dogovoru.

GARMIN — LONG 20 km (NEW PB), 11.09 06:19, 17°C:
20,01 km / 2:13:14 / avg 6:40/km / avg HR 152 (max 173). Recovery HR 50 (najbolji do sada). Exercise Load 202. Primary: VO2 Max. TE aerobic 4.5 / anaerobic 0. Stamina 96→38%. Body Battery -29. Kadenca 165 spm. Sweat 2220 ml.
Plan je bio: prvih 15 km lagano, poslednjih 5 km HM tempo.
Laps po km (min:sec): 7:11, 6:52, 6:51, 6:53, 6:58, 6:54, 6:55, 6:57, 6:59, 7:00, 7:01, 6:51, 6:59, 6:54, 6:59 — pa FINIŠ: 5:43, 5:42, 5:48, 5:50, 5:54.
Time in HR zones: Z5 (>168) 10%, Z4 (150-168) 49%, Z3 (132-149) 38%, Z2 1%.`;

console.log("→ Šaljem coachu (Sonnet, tvoj pun kontekst)...\n" + "═".repeat(64) + "\n");
const reply = await coachChat([{ role: "user", content: msg }], {
  profile, goalContext: buildGoalContext(profile, new Date().toISOString().slice(0, 10)), recentHistory, memory,
}, apiKey);
console.log(reply);
process.exit(0);
