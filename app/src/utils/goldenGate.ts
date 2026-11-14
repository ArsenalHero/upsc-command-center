import { csvCell } from "../services/export";
import type { MockAttempt, MockTest } from "./mockLab";

export const goldenFilterNames: Record<string, string> = {
  search: "Search", paper: "Paper", kind: "Test type", subject: "Subject",
  coachingId: "Coaching", year: "Year", series: "Series", topic: "Topic",
  difficulty: "Difficulty", status: "Availability", participation: "Attempt status",
  minQuestions: "Minimum questions", maxDuration: "Maximum minutes",
};
export function goldenBaseFilters(view: string): Record<string, string> {
  return view === "csat" ? { paper: "CSAT" } : view === "sectional" ? { kind: "Sectional" }
    : view === "full-length" ? { kind: "Full Length" } : {};
}
export function readGoldenSearch(value: string | null): Record<string, string> | null {
  try {
    const parsed: unknown = JSON.parse(value || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed).filter(([key, v]) => Object.prototype.hasOwnProperty.call(goldenFilterNames, key) && typeof v === "string" && v.length <= 200);
    return entries.length ? Object.fromEntries(entries) : null;
  } catch { return null; }
}
export function sortGoldenTests(tests: MockTest[], sort: string): MockTest[] {
  const visible = tests.slice(0, 12);
  return sort === "duration" ? visible.sort((a, b) => a.duration - b.duration)
    : sort === "participants" ? visible.sort((a, b) => b.participants - a.participants)
    : sort === "year" ? visible.sort((a, b) => b.year - a.year) : visible;
}
export function goldenSummaryCSV(attempt: MockAttempt): string {
  if (!attempt.result || attempt.status !== "submitted") throw new Error("Submit the test before downloading its summary.");
  const r = attempt.result;
  const rows: [string, unknown][] = [
    ["Test", attempt.test.name], ["Paper", attempt.test.paper], ["Coaching", attempt.test.coaching],
    ["Year", attempt.test.year], ["Attempt mode", attempt.eligible ? "Eligible first attempt" : "Practice only"],
    ["Submitted at", attempt.submittedAt || ""], ["Net score", r.score], ["Maximum marks", r.maximum],
    ["Correct", r.correct], ["Incorrect", r.incorrect], ["Unattempted", r.unattempted],
    ["Accuracy (%)", r.accuracy], ["Attempt rate (%)", r.attemptRate], ["Negative marks", r.negative],
    ["Completion time (seconds)", r.seconds], ["Eligible rank", attempt.eligible ? attempt.position?.rank ?? "Not available" : "Practice only"],
    ["Eligible percentile", attempt.eligible ? attempt.position?.percentile ?? "Not available" : "Practice only"],
  ];
  return "\ufeff" + [["Metric", "Value"], ...rows].map(row => row.map(value => typeof value === "number" && Number.isFinite(value) ? String(value) : csvCell(value)).join(",")).join("\r\n");
}
