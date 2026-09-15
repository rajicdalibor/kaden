import Anthropic from "@anthropic-ai/sdk";
import { SessionAnalysis, SESSION_ANALYSIS_JSON_SCHEMA } from "@kaden/shared-types";

const MODEL = "claude-sonnet-5";
const MAX_ATTEMPTS = 3;

const SYSTEM = `Ti si iskusan running/nutrition coach. Analiziraš ISKLJUČIVO brojeve iz
konteksta — ne izmišljaš podatke kojih nema (npr. Recovery HR ako nije dat).

Za dati trening popuni svako polje alata session_analysis po FIKSNOJ strukturi:
- basics: osnovni brojevi sažeto (distanca, vreme, pace, avg/max HR, TE, Load, kadenca).
- zones: zonska ocena po KORISNIKOVIM LTHR zonama (date u kontekstu). Je li ostao u
  ciljnoj zoni za taj tip treninga? Ima li "sive zone" (150-160)?
- assessment: iskrena, konkretna ocena kvaliteta.
- comparisons: poređenje sa NJEGOVIM prethodnim treninzima iz konteksta (isti tip):
  pace za dati HR, trend efikasnosti, kadenca — sa konkretnim brojevima i datumima.
- nextStep: konkretan sledeći korak (šta, kada, ciljni tempo/HR), u skladu sa fazom
  ka cilju (periodizacija iz konteksta).
- question: UVEK završi JEDNIM subjektivnim pitanjem (osećaj, listovi, san, Readiness).
- coachingNote: kratak fitness/wellness disclaimer — bez medicinskih dijagnoza/tvrdnji.
- memoryUpdate: 0-3 kratka zapažanja koja vredi zapamtiti (obrasci, preference).
- classification: tip treninga iz podataka. verdict: excellent | on_track | watch | back_off.

Ako su u kontekstu data prethodna zapažanja (coachingMemory.observations), REFERIŠI se
na njih: potvrdi napredak ili promenu obrasca, ne kreći od nule. Nova zapažanja u
memoryUpdate dodaj samo ako nose nešto novo u odnosu na postojeća.

Ako je dat focusSession.plannedIntent, oceni sesiju U ODNOSU NA PLAN (plan vs. stvarnost) —
NE kritikuj intenzitet/strukturu ako su bili NAMERNI po planu (npr. planiran tempo finiš na
dugom = izvršen plan, ne greška). Ako nema plannedIntent, tumačiš iz podataka ali NE
pretpostavljaj grešku kod neuobičajene strukture — pre pitaj (u polju question) da li je bilo
namerno. Ako je dat focusSession.subjective (osećaj/san/listovi/RPE), uklopi ga u ocenu i
sledeći korak.

Ton: iskren, direktan, topao, srpski. Poštuj 80/20 i progresiju <10%/ned.
Vrati ISKLJUČIVO poziv alata session_analysis.`;

export async function analyzeSession(
  context: unknown,
  apiKey: string,
): Promise<SessionAnalysis> {
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: JSON.stringify(context) },
  ];

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      // strukturiran izlaz — thinking nije potreban i trošio bi max_tokens (→ truncation)
      ...({ thinking: { type: "disabled" } } as any),
      tools: [{
        name: "session_analysis",
        description: "Vrati strukturiranu analizu jednog treninga.",
        input_schema: SESSION_ANALYSIS_JSON_SCHEMA as any,
      }],
      tool_choice: { type: "tool", name: "session_analysis" },
      messages,
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("no tool_use in response");

    const parsed = SessionAnalysis.safeParse(block.input);
    if (parsed.success) return parsed.data;

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
            `session_analysis. Greške:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
        }],
      },
    );
  }
  throw new Error(`SessionAnalysis nije validan ni posle ${MAX_ATTEMPTS} pokušaja: ${String(lastErr)}`);
}
