import Anthropic from "@anthropic-ai/sdk";
import { CoachPlan, COACH_PLAN_JSON_SCHEMA, type MetricsSummary } from "@kaden/shared-types";

const MODEL = "claude-sonnet-5-20260630"; // pinuj verziju u produkciji

const SYSTEM = `Ti si iskusan trener trčanja. Analiziraš SAMO dostavljene brojeve;
ne izmišljaš podatke. Daješ fitness/wellness savete, NIKAD medicinske dijagnoze
ni tvrdnje. Svaki coachingNote mora sadržati kratak disclaimer da ovo nije
medicinski savet. Poštuj 80/20 raspodelu intenziteta i progresiju volumena <10%/ned.
Vrati isključivo poziv alata training_plan po zadatoj šemi.`;

export async function generatePlan(
  summary: MetricsSummary,
  apiKey: string,
): Promise<CoachPlan> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [{
      name: "training_plan",
      description: "Vrati procenu i plan za sledeću nedelju.",
      input_schema: COACH_PLAN_JSON_SCHEMA as any,
    }],
    tool_choice: { type: "tool", name: "training_plan" },
    messages: [{ role: "user", content: JSON.stringify(summary) }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use in response");
  return CoachPlan.parse(block.input); // Zod validacija pre upisa
}
