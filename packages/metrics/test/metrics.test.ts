import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  zoneOf,
  zoneOfLthr,
  trimpBanister,
  aerobicDecoupling,
  acwr,
  isoWeek,
  polarizationIndex,
  buildMetricsSummary,
} from "../src/index.js";
import { AthleteProfile, type RawSession } from "@kaden/shared-types";

describe("zones", () => {
  it("mapira HR na zonu po % HRmax", () => {
    expect(zoneOf(90, 180)).toBe(0);   // 50%
    expect(zoneOf(126, 180)).toBe(2);  // 70%
    expect(zoneOf(170, 180)).toBe(4);  // 94%
  });
});
describe("zoneOfLthr", () => {
  it("mapira HR na LTHR zone (Daliborove granice, LTHR 169)", () => {
    expect(zoneOfLthr(110, 169)).toBe(0); // <114 → Z1
    expect(zoneOfLthr(140, 169)).toBe(2); // 134-152 → Z3 (recovery/long)
    expect(zoneOfLthr(160, 169)).toBe(3); // 153-169 → Z4 (tempo)
    expect(zoneOfLthr(175, 169)).toBe(4); // >169 → Z5 (intervali)
  });
});
describe("trimp", () => {
  it("raste sa intenzitetom i trajanjem", () => {
    const easy = trimpBanister([{ hr: 120, dtMin: 30 }], 50, 180, "male");
    const hard = trimpBanister([{ hr: 165, dtMin: 30 }], 50, 180, "male");
    expect(hard).toBeGreaterThan(easy);
    expect(easy).toBeGreaterThan(0);
  });
});
describe("decoupling", () => {
  it("null kod premalo uzoraka", () => {
    expect(aerobicDecoupling([{ spd: 3, hr: 150 }])).toBeNull();
  });
});
describe("acwr", () => {
  it("null ispod 28 dana istorije", () => {
    expect(acwr([1, 2, 3])).toBeNull();
  });
});

describe("isoWeek", () => {
  it("računa ISO nedelju (UTC)", () => {
    expect(isoWeek("2026-09-07")).toBe("2026-W37"); // ponedeljak
    expect(isoWeek("2026-09-11")).toBe("2026-W37"); // petak iste nedelje
    expect(isoWeek("2026-01-01")).toBe("2026-W01");
  });
});

describe("polarizationIndex", () => {
  it("null ako pojas nema vremena", () => {
    expect(polarizationIndex([50, 30, 20, 0, 0])).toBeNull(); // high=0
    expect(polarizationIndex([0, 0, 0, 50, 50])).toBeNull(); // low=0
  });
  it("raste kad je više vremena u niskom intenzitetu", () => {
    const polarized = polarizationIndex([70, 15, 5, 7, 3])!;
    const threshold = polarizationIndex([20, 20, 40, 15, 5])!;
    expect(polarized).toBeGreaterThan(threshold);
  });
});

describe("buildMetricsSummary (fixtures)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(here, "..", "fixtures");
  const sessions: RawSession[] = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(fixturesDir, f), "utf8")) as RawSession);
  const profile = AthleteProfile.parse({
    uid: "test",
    hrMax: 180,
    hrRest: 50,
    goal: { race: "general" },
  });

  it("sklapa summary sa nedeljama, recent i flag-ovima", () => {
    const s = buildMetricsSummary(sessions, profile);
    expect(s.rollingWeeks.length).toBeGreaterThan(0);
    expect(s.recentSessions.length).toBe(sessions.length);
    // 3 fixture sesije su unutar 28 dana → load nepouzdan
    expect(s.flags).toContain("insufficient_history_for_load");
    for (const w of s.rollingWeeks) {
      expect(w.zoneDistPct).toHaveLength(5);
      expect(w.zoneDistPct.reduce((a, b) => a + b, 0)).toBeGreaterThan(90);
    }
  });

  it("prazan ulaz → no_sessions", () => {
    expect(buildMetricsSummary([], profile).flags).toContain("no_sessions");
  });
});
