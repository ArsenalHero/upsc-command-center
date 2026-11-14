import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { validateData } from "../src/services/validation";
import { buildLectureCSV, lectureDays, lectureStats } from "../src/utils/lectures";
import type { LectureWorkspace } from "../src/types";
const data = createEmptyData();
const workspace = (): LectureWorkspace => ({ plans: [
  { id: "history", subjectId: data.subjects[0].id, course: "Foundation", target: 10, dailyTarget: 2, dueDate: "2026-10-05" },
  { id: "culture", subjectId: data.subjects[1].id, course: "Culture", target: 20, dailyTarget: 1, dueDate: "" },
], logs: [
  { id: "h1", planId: "history", date: "2026-10-01", completed: 8, minutes: 120, notes: "Ancient India" },
  { id: "h2", planId: "history", date: "2026-10-02", completed: 7, minutes: 60, notes: "Modern India" },
  { id: "c1", planId: "culture", date: "2026-10-02", completed: 3, minutes: 45, notes: "=unsafe CSV formula" },
  { id: "c2", planId: "culture", date: "2026-10-04", completed: 4, minutes: 60, notes: "Future fixture" },
] });
test("lecture totals keep each subject's remaining target independent and exclude future completions", () => {
  const s = lectureStats(workspace(), "2026-10-03");
  assert.equal(s.target, 30); assert.equal(s.completed, 18); assert.equal(s.remaining, 17);
  assert.equal(s.progress, 100 * 13 / 30); assert.equal(s.today, 0); assert.equal(s.weekly, 18);
  assert.equal(s.minutes, 225); assert.equal(s.streak, 2); assert.equal(s.activeDays, 2);
  const earlier = lectureStats(workspace(), "2026-10-01"); assert.equal(earlier.completed, 8); assert.equal(earlier.today, 8);
  const culture = lectureStats(workspace(), "2026-10-02", data.subjects[1].id);
  assert.equal(culture.completed, 3); assert.equal(culture.remaining, 17); assert.equal(culture.progress, 15);
});
test("daily lecture infographic fills empty dates and sums subjects without duplicating records", () => {
  assert.deepEqual(lectureDays(workspace(), "2026-10-03", 3), [{ date: "2026-10-01", completed: 8 }, { date: "2026-10-02", completed: 10 }, { date: "2026-10-03", completed: 0 }]);
  assert.equal(lectureDays(workspace(), "2026-10-03", 3, data.subjects[1].id)[1].completed, 3);
});
test("version-1 lecture backups and exports preserve daily data and reject invalid targets or duplicate days", () => {
  assert.equal(validateData(structuredClone(data)).lectures, undefined);
  const backup = { ...structuredClone(data), lectures: workspace() };
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(backup))).lectures, backup.lectures);
  assert.match(buildLectureCSV(backup), /Completed that day/); assert.match(buildLectureCSV(backup), /'=unsafe CSV formula/);
  const duplicate = structuredClone(backup); duplicate.lectures.logs.push({ ...duplicate.lectures.logs[0], id: "duplicate" });
  assert.throws(() => validateData(duplicate), /one daily entry/);
  for (const mutation of [
    (w: LectureWorkspace) => { w.plans[0].target = 1.5; },
    (w: LectureWorkspace) => { w.logs[0].completed = -1; },
    (w: LectureWorkspace) => { w.logs[0].planId = "missing"; },
    (w: LectureWorkspace) => { w.logs[0].date = "2026-02-30"; },
    (w: LectureWorkspace) => { w.plans[1].subjectId = w.plans[0].subjectId; },
  ]) { const bad = structuredClone(backup); mutation(bad.lectures); assert.throws(() => validateData(bad)); }
});
