export const dateKey = (date: Date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);
export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
export const prettyDate = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) => (s ? parseDate(s).toLocaleDateString(undefined, opts) : "—");
export const weekStart = (s: string = dateKey()) => {
  const d = parseDate(s);
  return addDays(s, -((d.getDay() + 6) % 7));
};
export const monthStart = (s: string = dateKey()) => s.slice(0, 7) + "-01";
export const monthEnd = (s: string) => {
  const d = parseDate(monthStart(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return dateKey(d);
};
export const monthsAgo = (s: string, n: number) => {
  const d = parseDate(monthStart(s));
  d.setMonth(d.getMonth() - n);
  return dateKey(d);
};
export const periodBounds = (
  period: string,
  anchor: string = dateKey(),
): [string, string] => {
  if (period === "Daily") return [anchor, anchor];
  if (period === "Weekly")
    return [weekStart(anchor), addDays(weekStart(anchor), 6)];
  if (period === "Monthly") return [monthStart(anchor), monthEnd(anchor)];
  if (period === "Quarterly") {
    const d = parseDate(anchor);
    d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
    const start = dateKey(d);
    d.setMonth(d.getMonth() + 3);
    d.setDate(0);
    return [start, dateKey(d)];
  }
  return [anchor.slice(0, 4) + "-01-01", anchor.slice(0, 4) + "-12-31"];
};
export const dateRange = (from: string, to: string) => {
  const result: string[] = [];
  for (let d = from; d <= to && result.length < 3660; d = addDays(d, 1))
    result.push(d);
  return result;
};
export const inRange = (d: string, from: string, to: string) =>
  d >= from && d <= to;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const round = (n: number, p = 1) => Number(n.toFixed(p));
export const pct = (n: number, d: number): number | null =>
  d > 0 ? round((n / d) * 100) : null;
export const number = (n: number | null, suffix = "") =>
  n === null
    ? "—"
    : `${Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n)}${suffix}`;
