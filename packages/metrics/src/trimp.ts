/** Banister TRIMP. hrr = (hr-rest)/(max-rest); k=1.92 (m), 1.67 (ž). */
export function trimpBanister(
  samples: { hr: number | null; dtMin: number }[],
  hrRest: number, hrMax: number, sex: "male" | "female",
): number {
  const k = sex === "male" ? 1.92 : 1.67;
  let total = 0;
  for (const { hr, dtMin } of samples) {
    if (hr == null) continue;
    let hrr = (hr - hrRest) / (hrMax - hrRest);
    hrr = Math.max(0, Math.min(1, hrr));
    total += dtMin * hrr * 0.64 * Math.exp(k * hrr);
  }
  return total;
}
