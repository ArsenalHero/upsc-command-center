import type { AppData } from "../types";
import { aggregate } from "./analytics";
import { dateKey, prettyDate } from "./date";

export function todaySnapshot(data: AppData, today = dateKey()) {
  const daily = aggregate(data, today, today);
  const seconds = data.sessions.filter(s => s.date === today).reduce((sum, s) => sum + s.actualMinutes * 60, 0)
    + data.pyqs.filter(p => p.date === today && p.attempt).reduce((sum, p) => sum + p.attempt!.seconds, 0);
  const targetSeconds = data.settings.dailyHours * 3600;
  const pending = data.revisions.filter(r => !r.completedDate).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  return {
    daily, seconds, targetSeconds,
    remainingMinutes: Math.max(0, Math.ceil((targetSeconds - seconds) / 60)),
    targetReached: seconds >= targetSeconds,
    progress: Math.min(100, Math.max(0, seconds / targetSeconds * 100)),
    due: pending.filter(r => r.dueDate <= today),
    next: pending[0],
    completedToday: data.revisions.filter(r => r.completedDate === today).length,
  };
}

export function studyDuration(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60), hours = Math.floor(minutes / 60);
  if (seconds > 0 && minutes === 0) return "Less than 1 min";
  return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes} min`;
}

const navigationAliases: Record<string, string> = {
  "/": "home today overview dashboard",
  "/tests": "golden gate mock exam test series",
  "/pyqs": "papers previous year questions practice",
  "/reports": "analytics performance statistics",
  "/settings": "themes wallpapers targets appearance",
  "/revision": "review recall spaced repetition",
  "/daily-study": "session log study time",
};
export function matchingPages<T extends { label: string; path: string; group: string }>(pages: T[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return pages.filter(p => {
    const words = `${p.label} ${p.path} ${p.group} ${navigationAliases[p.path] || ""}`.toLowerCase().split(/[^\p{L}\p{N}]+/u);
    return terms.every(term => words.some(word => word.startsWith(term)));
  });
}
export function currentPage<T extends { path: string }>(pages: T[], pathname: string): T | undefined {
  return pages.filter(p => pathname === p.path || (p.path !== "/" && pathname.startsWith(p.path + "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

const normalizeSearch = (value: string) => value.normalize("NFKC").toLowerCase();
export function recordSearchIndex<T extends object>(data: AppData, records: readonly T[]) {
  const subjects = new Map(data.subjects.map(s => [s.id, s.name]));
  const topics = new Map(data.topics.map(t => [t.id, t.name]));
  const resources = new Map(data.resources.map(r => [r.id, r.name]));
  const series = new Map(data.catalog.map(s => [s.id, s.name]));
  return records.map(record => {
    const r = record as Record<string, unknown>;
    const values = Object.values(r).filter(v => typeof v === "string" || typeof v === "number");
    const date = String(r.date || r.dueDate || "");
    const context = [subjects.get(String(r.subjectId)), topics.get(String(r.topicId)), topics.get(String(r.subtopicId)), resources.get(String(r.resourceId)), series.get(String(r.seriesId)), /^\d{4}-\d{2}-\d{2}$/.test(date) ? prettyDate(date, { day: "numeric", month: "long", year: "numeric" }) : ""];
    return { record, text: normalizeSearch([...values, ...context.filter(Boolean)].join(" ")) };
  });
}
export function matchingRecords<T>(index: { record: T; text: string }[], query: string): T[] {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return index.filter(item => terms.every(term => item.text.includes(term))).map(item => item.record);
}
