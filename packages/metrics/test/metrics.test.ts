import { describe, it, expect } from "vitest";
import { zoneOf, trimpBanister, aerobicDecoupling, acwr } from "../src/index.js";

describe("zones", () => {
  it("mapira HR na zonu po % HRmax", () => {
    expect(zoneOf(90, 180)).toBe(0);   // 50%
    expect(zoneOf(126, 180)).toBe(2);  // 70%
    expect(zoneOf(170, 180)).toBe(4);  // 94%
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
