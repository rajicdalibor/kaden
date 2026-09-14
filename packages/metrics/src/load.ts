/** EWMA (CTL 42d / ATL 7d) i ACWR. Ulaz: dnevni niz opterećenja (TRIMP). */
export function ewma(daily: number[], tau: number, seed = 0): number[] {
  const a = 2 / (tau + 1);
  let v = seed;
  return daily.map((x) => (v = v + a * (x - v)));
}
export function ctlAtlTsb(daily: number[]) {
  const ctl = ewma(daily, 42);
  const atl = ewma(daily, 7);
  const last = daily.length - 1;
  return { ctl: ctl[last] ?? 0, atl: atl[last] ?? 0, tsb: (ctl[last] ?? 0) - (atl[last] ?? 0) };
}
/** ACWR = akutni (7d sum) / prosečni hronični nedeljni (28d sum / 4). */
export function acwr(daily: number[]): number | null {
  if (daily.length < 28) return null;
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0);
  const acute = sum(daily.slice(-7));
  const chronicWeekly = sum(daily.slice(-28)) / 4;
  return chronicWeekly === 0 ? null : Math.round((acute / chronicWeekly) * 100) / 100;
}
