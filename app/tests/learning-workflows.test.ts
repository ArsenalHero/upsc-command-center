import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { validateBooks, validateLectures } from "../src/services/validation";
import { normalizeAppearance, selectedLandscape } from "../src/utils/appearance";
import { bookStats, buildBookCSV } from "../src/utils/books";
import { lectureNeedsAttention, lectureStats, updateLectureDay } from "../src/utils/lectures";
import { addDays, dateKey } from "../src/utils/date";
import type { BookWorkspace, LectureWorkspace } from "../src/types";

const today = dateKey(), yesterday = addDays(today, -1);
const data = createEmptyData(), subjects = new Set(data.subjects.map(s => s.id));
const books = (): BookWorkspace => ({
  plans: [{ id: "book", title: "Reading plan", author: "", edition: "", subjectId: data.subjects[0].id, totalChapters: 8, revisionTarget: 2, dailyTarget: 2, dueDate: addDays(today, 2) }],
  logs: [
    { id: "old", bookId: "book", kind: "reading", date: yesterday, chapters: [1], repeats: 1, notes: "" },
    { id: "read", bookId: "book", kind: "reading", date: today, chapters: [1, 2, 3], repeats: 1, notes: "" },
    { id: "review", bookId: "book", kind: "revision", date: today, chapters: [2], repeats: 2, notes: "" },
  ],
});
const lectures = (): LectureWorkspace => ({
  plans: data.subjects.slice(0, 2).map((s, i) => ({ id: `plan-${i}`, subjectId: s.id, course: "Course", target: 10, dailyTarget: 2, dueDate: today })),
  logs: [
    { id: "past", planId: "plan-0", date: yesterday, completed: 2, minutes: 60, notes: "Earlier day" },
    { id: "today", planId: "plan-0", date: today, completed: 3, minutes: 90, notes: "Keep this note" },
    { id: "other", planId: "plan-1", date: today, completed: 1, minutes: 30, notes: "Unselected subject" },
  ],
});

test("favourites are allow-listed, deduplicated and drive a stable daily rotation", () => {
  const appearance = normalizeAppearance({ favourites: ["dunes", "forest", "dunes", "https://example.test/image", null], position: "right", paused: true });
  assert.deepEqual(appearance.favourites, ["forest", "dunes"]);
  assert.equal(appearance.position, "right"); assert.equal(appearance.paused, true);
  const ids = Array.from({ length: 8 }, (_, i) => selectedLandscape("daily", addDays(today, i), appearance.favourites)?.id);
  assert.deepEqual(new Set(ids), new Set(["forest", "dunes"]));
  assert.equal(selectedLandscape("daily", today, appearance.favourites)?.id, selectedLandscape("daily", today, appearance.favourites)?.id);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(selectedLandscape("daily", today, ["dunes"])?.id, "dunes");
  assert.ok(selectedLandscape("daily", today, []));
  assert.equal(normalizeAppearance({ position: "url(x)", paused: "true" }).position, "center");
  assert.equal(normalizeAppearance({ paused: "true" }).paused, false);
});

test("reading goals count first completion dates and suggest unfinished chapters", () => {
  const w = books(); validateBooks(w, subjects);
  const b = bookStats(w, "", today).books[0];
  assert.equal(b.completed, 3); assert.equal(b.readingToday, 2);
  assert.equal(b.nextUnread, 4); assert.equal(b.nextRevision, 1);
  assert.equal(b.neededPerDay, 2);
  const prior = bookStats(w, "", yesterday).books[0];
  assert.equal(prior.completed, 1); assert.equal(prior.nextUnread, 2);
  w.logs.push({ id: "review-1", bookId: "book", date: today, kind: "revision", chapters: [1], repeats: 1, notes: "" });
  assert.equal(bookStats(w).books[0].nextRevision, 3);
  w.plans[0].dueDate = yesterday;
  assert.equal(bookStats(w).books[0].neededPerDay, null);
});

test("legacy books remain valid and optional goals survive exports and validation", () => {
  const w = books(); delete w.plans[0].dailyTarget; delete w.plans[0].dueDate;
  validateBooks(w, subjects);
  w.plans[0].dailyTarget = 3; w.plans[0].dueDate = addDays(today, 3);
  const exported = buildBookCSV({ ...data, books: w });
  assert.match(exported, /"Daily chapter goal","Reading deadline"/);
  assert.ok(exported.includes(`,"3","${addDays(today, 3)}"`));
  w.plans[0].dailyTarget = 1.5;
  assert.throws(() => validateBooks(w, subjects), /Daily chapter goal/);
  w.plans[0].dailyTarget = 3; w.plans[0].dueDate = "2026-02-30";
  assert.throws(() => validateBooks(w, subjects), /deadline/);
});

test("batch lecture totals replace selected days without changing history or other subjects", () => {
  const original = lectures(), before = JSON.stringify(original);
  const row = { planId: "plan-0", completed: 4, minutes: 90, notes: "Keep this note" };
  const next = updateLectureDay(original, today, [row]);
  validateLectures(next, subjects);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(next.logs.find(l => l.id === "past"), original.logs[0]);
  assert.deepEqual(next.logs.find(l => l.id === "other"), original.logs[2]);
  assert.equal(next.logs.find(l => l.id === "today")?.completed, 4);
  assert.equal(next.logs.length, 3);
  const again = updateLectureDay(next, today, [row]);
  assert.equal(again.logs.length, 3);
  assert.equal(lectureStats(again, today).completed, 7);
  assert.throws(() => updateLectureDay(original, today, [row, row]), /once/);
});

test("batch validation rejects invalid totals before the workspace is saved", () => {
  const w = lectures();
  const next = updateLectureDay(w, today, [{ planId: "plan-0", completed: 0, minutes: 90, notes: "" }]);
  assert.throws(() => validateLectures(next, subjects), /completions/);
  assert.equal(w.logs[1].completed, 3);
});

test("deadline attention uses remaining work and daily pace at the selected date", () => {
  const active = { remaining: 5, dueDate: today, neededPerDay: 5, dailyTarget: 2 };
  assert.equal(lectureNeedsAttention(active), true);
  assert.equal(lectureNeedsAttention({ ...active, neededPerDay: null }), true);
  assert.equal(lectureNeedsAttention({ ...active, dailyTarget: 5 }), false);
  assert.equal(lectureNeedsAttention({ ...active, remaining: 0 }), false);
  assert.equal(lectureNeedsAttention({ ...active, dueDate: "" }), false);
});
