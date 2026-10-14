import type { AppData, LectureLog, LectureWorkspace } from "../types";
import { addDays, dateKey, dateRange, daysBetween, uid, weekStart } from "./date";
import { csvCell } from "../services/export";

export const emptyLectures = (): LectureWorkspace => ({ plans: [], logs: [] });
export type LectureDayUpdate = Pick<LectureLog, "planId" | "completed" | "minutes" | "notes">;
// A daily total replaces that day's entry; selected rows never add duplicate logs.
export function updateLectureDay(w: LectureWorkspace, date: string, rows: LectureDayUpdate[]): LectureWorkspace {
  const ids = new Set(rows.map(r => r.planId));
  if (ids.size !== rows.length) throw new Error("Select each lecture subject once.");
  const saved = new Map(w.logs.filter(l => l.date === date).map(l => [l.planId, l.id]));
  const entries = rows.map(row => ({ ...row, date, id: saved.get(row.planId) || uid() }));
  return { ...w, logs: [...w.logs.filter(l => l.date !== date || !ids.has(l.planId)), ...entries] };
}
export function lectureNeedsAttention(p: { remaining: number; dueDate: string; neededPerDay: number | null; dailyTarget: number }) {
  return p.remaining > 0 && !!p.dueDate && (p.neededPerDay === null || p.neededPerDay > p.dailyTarget);
}
export function lectureStats(w: LectureWorkspace, anchor = dateKey(), subjectId = "") {
  const plans = w.plans.filter(p => !subjectId || p.subjectId === subjectId);
  const ids = new Set(plans.map(p => p.id));
  const logs = w.logs.filter(l => ids.has(l.planId) && l.date <= anchor);
  const totals = new Map(plans.map(p => [p.id, { completed: 0, today: 0, minutes: 0 }]));
  for (const log of logs) {
    const value = totals.get(log.planId)!;
    value.completed += log.completed; value.minutes += log.minutes;
    if (log.date === anchor) value.today += log.completed;
  }
  const subjects = plans.map(p => {
    const { completed, today, minutes } = totals.get(p.id)!;
    const remaining = Math.max(0, p.target - completed);
    const daysLeft = p.dueDate ? daysBetween(anchor, p.dueDate) + 1 : null;
    return { ...p, completed, remaining, today, progress: Math.min(100, 100 * completed / p.target), minutes, neededPerDay: daysLeft && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : null };
  });
  const target = subjects.reduce((n, p) => n + p.target, 0);
  const completed = subjects.reduce((n, p) => n + p.completed, 0);
  const remaining = subjects.reduce((n, p) => n + p.remaining, 0);
  const covered = subjects.reduce((n, p) => n + Math.min(p.target, p.completed), 0);
  const days = new Set(logs.map(l => l.date));
  let streak = 0, cursor = days.has(anchor) ? anchor : addDays(anchor, -1);
  while (days.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return { subjects, logs, target, completed, remaining, progress: target ? 100 * covered / target : 0, today: subjects.reduce((n, p) => n + p.today, 0), weekly: logs.filter(l => l.date >= weekStart(anchor)).reduce((n, l) => n + l.completed, 0), minutes: logs.reduce((n, l) => n + l.minutes, 0), activeDays: days.size, streak };
}
export function lectureDays(w: LectureWorkspace, to = dateKey(), count = 14, subjectId = "") {
  const ids = new Set(w.plans.filter(p => !subjectId || p.subjectId === subjectId).map(p => p.id));
  const totals = new Map<string, number>();
  for (const l of w.logs) if (ids.has(l.planId)) totals.set(l.date, (totals.get(l.date) || 0) + l.completed);
  return dateRange(addDays(to, 1 - count), to).map(date => ({ date, completed: totals.get(date) || 0 }));
}
export function buildLectureCSV(data: AppData) {
  const w = data.lectures || emptyLectures();
  const headers = ["Date", "Subject", "Course", "Total target", "Daily target", "Deadline", "Completed that day", "Minutes", "Notes"];
  const rows = [...w.logs].sort((a, b) => a.date.localeCompare(b.date)).map(l => {
    const p = w.plans.find(p => p.id === l.planId)!;
    return [l.date, data.subjects.find(s => s.id === p.subjectId)?.name || "", p.course, p.target, p.dailyTarget, p.dueDate, l.completed, l.minutes, l.notes];
  });
  return "\ufeff" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
