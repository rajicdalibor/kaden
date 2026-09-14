/** Aerobni decoupling (Pa:HR drift): (EF_1 - EF_2)/EF_1 * 100. Poz = umor. */
export function aerobicDecoupling(
  pairs: { spd: number; hr: number }[],
): number | null {
  const p = pairs.filter((x) => x.spd > 0.5 && x.hr > 0);
  if (p.length < 20) return null;
  const half = Math.floor(p.length / 2);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const ef1 = mean(p.slice(0, half).map((x) => x.spd / x.hr));
  const ef2 = mean(p.slice(half).map((x) => x.spd / x.hr));
  return Math.round(((ef1 - ef2) / ef1) * 1000) / 10;
}
