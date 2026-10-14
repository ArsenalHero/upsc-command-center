import test from "node:test";
import assert from "node:assert/strict";
import { bookStats } from "../src/utils/books";
import { lectureStats } from "../src/utils/lectures";
import { addDays, dateKey } from "../src/utils/date";
import type { BookWorkspace, LectureWorkspace } from "../src/types";

// Count visits rather than asserting wall-clock timings on shared CI machines.
function countVisits<T extends object>(records: T[]) {
  let visits = 0, ownerReads = 0;
  const tracked = records.map(record => new Proxy(record, { get(target, key, receiver) { if (key === "bookId" || key === "planId") ownerReads++; return Reflect.get(target, key, receiver); } }));
  const logs = new Proxy(tracked, { get(target, key, receiver) { if (typeof key === "string" && /^\d+$/.test(key)) visits++; return Reflect.get(target, key, receiver); } });
  return { logs, visits: () => visits, ownerReads: () => ownerReads };
}
const today = dateKey(), plans = 160, entries = plans * 30;

test("book progress scans a large history once and retains subject/date totals", () => {
  const counted = countVisits(Array.from({ length: entries }, (_, i) => ({ id: `l${i}`, bookId: `b${i % plans}`, date: addDays(today, -Math.floor(i / plans)), kind: "reading" as const, chapters: [Math.floor(i / plans) + 1], repeats: 1, notes: "" })));
  const w: BookWorkspace = { plans: Array.from({ length: plans }, (_, i) => ({ id: `b${i}`, title: `Book ${i}`, author: "", edition: "", subjectId: `s${i % 2}`, totalChapters: 30, revisionTarget: 2 })), logs: counted.logs };
  const result = bookStats(w, "", today);
  assert.equal(result.completed, entries); assert.equal(result.remaining, 0);
  assert.equal(result.books[0].readingToday, 1); assert.equal(result.books[0].logs.length, 30);
  assert.ok(counted.visits() <= entries * 2, "Reading more books must not rescan the full log array per book");
  assert.ok(counted.ownerReads() <= entries * 3, "Filtered copies must not multiply book-ID comparisons by the number of plans");
  const filtered = bookStats(w, "s1", addDays(today, -1));
  assert.equal(filtered.books.length, plans / 2); assert.equal(filtered.completed, plans / 2 * 29);
  assert.equal(w.logs.length, entries); assert.equal(w.plans[0].totalChapters, 30);
});

test("lecture progress scans history independently of the number of targets", () => {
  const counted = countVisits(Array.from({ length: entries }, (_, i) => ({ id: `l${i}`, planId: `p${i % plans}`, date: addDays(today, -Math.floor(i / plans)), completed: 2, minutes: 45, notes: "" })));
  const w: LectureWorkspace = { plans: Array.from({ length: plans }, (_, i) => ({ id: `p${i}`, subjectId: `s${i}`, course: "Course", target: 60, dailyTarget: 2, dueDate: addDays(today, 3) })), logs: counted.logs };
  const result = lectureStats(w, today);
  assert.equal(result.completed, entries * 2); assert.equal(result.progress, 100);
  assert.equal(result.today, plans * 2); assert.equal(result.streak, 30); assert.equal(result.minutes, entries * 45);
  assert.ok(counted.visits() <= entries * 3, "Adding targets must not multiply scans of the full history");
  assert.ok(counted.ownerReads() <= entries * 3, "Filtered copies must not multiply plan-ID comparisons by the number of targets");
  const filtered = lectureStats(w, addDays(today, -1), "s2");
  assert.equal(filtered.completed, 58); assert.equal(filtered.remaining, 2); assert.equal(filtered.today, 2);
});
