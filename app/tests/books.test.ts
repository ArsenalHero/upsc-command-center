import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { validateData } from "../src/services/validation";
import { bookStats, buildBookCSV, formatChapters, parseChapters } from "../src/utils/books";
import { bookSuggestions } from "../src/data/bookSuggestions";
import type { BookWorkspace } from "../src/types";

const data = createEmptyData();
const workspace = (): BookWorkspace => ({ plans: [
  { id: "polity", subjectId: data.subjects[0].id, title: "Test Polity", author: "Author", edition: "User edition", totalChapters: 4, revisionTarget: 2 },
  { id: "geography", subjectId: data.subjects[1].id, title: "Test Geography", author: "", edition: "", totalChapters: 6, revisionTarget: 1 },
], logs: [
  { id: "read", bookId: "polity", date: "2026-10-01", kind: "reading", chapters: [1, 2, 3], repeats: 1, notes: "First reading" },
  { id: "overlap", bookId: "polity", date: "2026-10-02", kind: "reading", chapters: [2, 3], repeats: 1, notes: "Duplicate reading does not inflate completion" },
  { id: "revision", bookId: "polity", date: "2026-10-02", kind: "revision", chapters: [1, 2], repeats: 3, notes: "Earlier reviews" },
  { id: "read-other", bookId: "geography", date: "2026-10-03", kind: "reading", chapters: [1], repeats: 1, notes: "Another subject" },
] });

test("chapter lists accept numbers, mixed ranges, whitespace and pasted dashes without duplicate completion", () => {
  assert.deepEqual(parseChapters("1,2,3", 10), [1, 2, 3]);
  assert.deepEqual(parseChapters(" 1 - 4, 7, 3, 9–10 ", 10), [1, 2, 3, 4, 7, 9, 10]);
  assert.deepEqual(parseChapters("4-4,0002,2", 4), [2, 4]);
  assert.deepEqual(parseChapters(" ", 4, true), []);
  assert.equal(parseChapters("1-1000", 1000).length, 1000);
});
test("chapter lists reject malformed, reversed, fractional, empty and out-of-range entries before changing data", () => {
  for (const value of ["", "0", "5", "2-1", "-1", "1.5", "1,,2", "1,", "1;2", "1-2-3", "1-10000000", "9007199254740992"]) assert.throws(() => parseChapters(value, 4));
  for (const total of [0, 1.5, 1001, NaN]) assert.throws(() => parseChapters("1", total));
});
test("chapter formatting round trips disjoint ranges and sorts unique numbers", () => {
  assert.equal(formatChapters([9, 3, 1, 2, 3, 6, 7]), "1-3,6-7,9");
  assert.deepEqual(parseChapters(formatChapters([7, 1, 2, 4, 5]), 10), [1, 2, 4, 5, 7]);
  assert.equal(formatChapters([]), "");
});
test("book progress counts unique chapters and caps each chapter's revision credit independently", () => {
  const s = bookStats(workspace(), "", "2026-10-03");
  assert.equal(s.total, 10); assert.equal(s.completed, 4); assert.equal(s.remaining, 6); assert.equal(s.progress, 40);
  assert.equal(s.chapterReviews, 6); assert.equal(s.finishedBooks, 0);
  assert.equal(s.revisionProgress, 100 * 4 / 14);
  assert.equal(s.books[0].progress, 75); assert.equal(s.books[0].fullRevisions, 0);
  assert.equal(s.books[0].revisionProgress, 50);
  assert.equal(s.books[0].chapters[2].revisions, 0);
  assert.equal(bookStats(workspace(), data.subjects[1].id, "2026-10-03").progress, 100 / 6);
  const earlier = bookStats(workspace(), "", "2026-10-01");
  assert.equal(earlier.completed, 3); assert.equal(earlier.chapterReviews, 0);
});
test("full book revisions require every chapter and target-free books still keep revision counts", () => {
  const w = workspace();
  w.logs.push({ id: "last", bookId: "polity", date: "2026-10-03", kind: "reading", chapters: [4], repeats: 1, notes: "" });
  w.logs.push({ id: "full", bookId: "polity", date: "2026-10-03", kind: "revision", chapters: [1, 2, 3, 4], repeats: 2, notes: "" });
  const s = bookStats(w, "", "2026-10-03");
  assert.equal(s.books[0].fullRevisions, 2); assert.equal(s.books[0].chapterReviews, 14); assert.equal(s.books[0].revisionProgress, 100); assert.equal(s.finishedBooks, 1);
  w.plans[0].revisionTarget = 0;
  assert.equal(bookStats(w).books[0].chapterReviews, 14); assert.equal(bookStats(w).books[0].revisionProgress, 0);
});
test("old version-1 workspaces remain valid and book JSON and CSV preserve chapters, counts, dates and notes", () => {
  assert.equal(validateData(structuredClone(data)).books, undefined);
  const backup = { ...structuredClone(data), books: workspace() };
  backup.books.plans[0].title = "=Test title"; backup.books.logs[0].notes = "=unsafe formula";
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(backup))).books, backup.books);
  const csv = buildBookCSV(backup);
  assert.match(csv, /"'=Test title"/); assert.match(csv, /"'=unsafe formula"/);
  assert.match(csv, /"1-3"/); assert.match(csv, /"Full book revisions"/); assert.match(csv, /"2026-10-02","'=Test title","revision","1-2","3"/);
});
test("invalid imports and edits cannot orphan revisions, shrink recorded chapters or point at missing books or subjects", () => {
  const changes: ((w: BookWorkspace) => void)[] = [
    w => { w.plans[0].totalChapters = 2; }, w => { w.plans[0].revisionTarget = 1.5; },
    w => { w.plans[0].title = " "; }, w => { w.plans[0].subjectId = "missing"; },
    w => { w.logs[0].chapters = [1, 1]; }, w => { w.logs[0].chapters = [0]; },
    w => { w.logs[0].bookId = "missing"; }, w => { w.logs[0].date = "2026-02-30"; },
    w => { w.logs[0].repeats = 2; }, w => { w.logs[2].repeats = 0; },
    w => { w.logs[2].chapters = [4]; }, w => { w.logs[2].date = "2026-09-30"; },
    w => { w.logs = w.logs.filter(l => l.kind !== "reading"); },
    w => { w.logs.push({ ...w.logs[0] }); }, w => { w.plans.push({ ...w.plans[0] }); },
  ];
  for (const change of changes) { const backup = { ...structuredClone(data), books: workspace() }; change(backup.books); assert.throws(() => validateData(backup)); }
});
test("suggestions have distinct identities and NCERT or publisher source links without assumed chapter totals", () => {
  assert.equal(new Set(bookSuggestions.map(b => b.id)).size, bookSuggestions.length);
  assert.equal(bookSuggestions.filter(b => b.free).length, 3);
  const hosts = new Set(["ncert.nic.in", "www.mheducation.co.in", "spectrumbooks.in", "india.oup.com", "www.shankariasacademy.com", "edge.mheducation.co.in"]);
  for (const b of bookSuggestions) { assert.ok(hosts.has(new URL(b.url).hostname)); assert.ok(b.title && b.subject && b.author); assert.equal("totalChapters" in b, false); }
});
