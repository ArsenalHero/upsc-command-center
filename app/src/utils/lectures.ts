import type { AppData, LectureWorkspace } from "../types";
import { addDays, dateKey, dateRange, daysBetween, weekStart } from "./date";
import { csvCell } from "../services/export";

export const emptyLectures = (): LectureWorkspace => ({ plans: [], logs: [] });
export function lectureStats(w: LectureWorkspace, anchor = dateKey(), subjectId = "") {
  const plans = w.plans.filter(p => !subjectId || p.subjectId === subjectId);
  const ids = new Set(plans.map(p => p.id));
  const logs = w.logs.filter(l => ids.has(l.planId) && l.date <= anchor);
  const subjects = plans.map(p => {
    const entries = logs.filter(l => l.planId === p.id);
    const completed = entries.reduce((n, l) => n + l.completed, 0);
    const remaining = Math.max(0, p.target - completed);
    const today = entries.filter(l => l.date === anchor).reduce((n, l) => n + l.completed, 0);
    const daysLeft = p.dueDate ? daysBetween(anchor, p.dueDate) + 1 : null;
    return { ...p, completed, remaining, today, progress: Math.min(100, 100 * completed / p.target), minutes: entries.reduce((n, l) => n + l.minutes, 0), neededPerDay: daysLeft && daysLeft > 0 ? Math.ceil(remaining / daysLeft) : null };
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
