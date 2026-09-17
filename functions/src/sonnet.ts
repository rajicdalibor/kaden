import Anthropic from "@anthropic-ai/sdk";
import { CoachPlan, COACH_PLAN_JSON_SCHEMA, type MetricsSummary } from "@kaden/shared-types";

const MODEL = "claude-haiku-4-5"; // jeftiniji; sa punim kontekstom + few-shot drži kvalitet
const MAX_ATTEMPTS = 3; // 1 poziv + do 2 korekcije na osnovu Zod greške

const SYSTEM = `Ti si iskusan trener trčanja. Analiziraš SAMO dostavljene brojeve;
ne izmišljaš podatke. Daješ fitness/wellness savete, NIKAD medicinske dijagnoze
ni tvrdnje. Svaki coachingNote mora sadržati kratak disclaimer da ovo nije
medicinski savet. Poštuj 80/20 raspodelu intenziteta i progresiju volumena <10%/ned.
Poštuj granice šeme: keyObservations najviše 4 stavke; svaki nextWeekPlan.day iz
{mon..sun} bez ponavljanja. Vrati isključivo poziv alata training_plan po šemi.`;

export async function generatePlan(
  summary: MetricsSummary,
  apiKey: string,
): Promise<CoachPlan> {
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: JSON.stringify(summary) },
  ];

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      tools: [{
        name: "training_plan",
        description: "Vrati procenu i plan za sledeću nedelju.",
        input_schema: COACH_PLAN_JSON_SCHEMA as any,
      }],
      tool_choice: { type: "tool", name: "training_plan" },
      messages,
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("no tool_use in response");

    const parsed = CoachPlan.safeParse(block.input); // Zod validacija pre upisa
    if (parsed.success) return parsed.data;

    // Vrati grešku modelu kao tool_result i traži ispravku (nema strict u SDK 0.32.1).
    lastErr = parsed.error;
    messages.push(
      { role: "assistant", content: res.content },
      {
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content:
            "Izlaz ne prolazi validaciju šeme. Ispravi i vrati ponovo poziv " +
            `training_plan. Greške:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        }],
      },
    );
  }

  throw new Error(
    `CoachPlan nije validan ni posle ${MAX_ATTEMPTS} pokušaja: ${String(lastErr)}`,
  );
}
