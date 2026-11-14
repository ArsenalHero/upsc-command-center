import test from "node:test";
import assert from "node:assert/strict";
import additions from "../src/data/cse-2019-2020-bank";
import previous2025 from "../src/data/pyq-bank.json";
import catalog from "../docs/CSE-2019-2020-IMPORT.json";
import { originalBank, questionById } from "../src/data/questionBank";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { validateData, validatePrelims } from "../src/services/validation";
import { LocalStorageRepository } from "../src/services/repository";
import type { PYQQuestion } from "../src/utils/pyq";

const bank = additions as PYQQuestion[];
const paper = (year: number, stage: "Prelims" | "CSAT") => bank.filter(q => q.year === year && q.stage === stage);
const question = (year: number, stage: "Prelims" | "CSAT", number: number) => paper(year, stage).find(q => q.number === number)!;
const session = (qs: PYQQuestion[]) => startSession(qs, "test", emptyFilters(), true, new Date("2026-10-09T10:00:00Z"));
const respond = (s: ReturnType<typeof session>, q: PYQQuestion, option = q.answer || "a") => {
  s.responses[q.id] = { ...emptyResponse(), option, submitted: true, seconds: 30, key: keySnapshot(q) };
};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("four complete papers retain matching booklet order and final answer keys", () => {
  assert.equal(bank.length, 360);
  assert.equal(new Set(bank.map(q => q.id)).size, 360);
  for (const p of catalog.papers) {
    const qs = paper(p.year, p.stage as "Prelims" | "CSAT");
    assert.equal(qs.length, p.stage === "CSAT" ? 80 : 100);
    assert.deepEqual(qs.map(q => q.number), Array.from({ length: qs.length }, (_, i) => i + 1));
    assert.deepEqual(qs.map(q => q.answer?.toUpperCase() || "X"), p.answers);
    for (const q of qs) {
      assert.equal(q.booklet, p.booklet);
      assert.deepEqual(Object.keys(q.options), ["a", "b", "c", "d"]);
      assert.ok(Object.values(q.options).every(v => v.trim()));
      assert.ok(q.explanation?.justification || q.suppliedExplanationIds?.length, q.id);
      assert.equal(questionById.get(q.id)?.answer, q.answer, q.id);
      assert.equal(questionById.get(q.id)?.keyStatus, q.keyStatus, q.id);
    }
  }
  // Content anchors guard against accidentally applying another booklet's key.
  assert.equal(question(2019, "Prelims", 2).options.d, "Water reservoirs");
  assert.equal(question(2019, "CSAT", 1).options.c, "300");
  assert.equal(question(2020, "Prelims", 80).options.a, "Ashoka");
  assert.equal(question(2020, "CSAT", 11).options.b, "3");
  assert.equal(question(2020, "Prelims", 51).answer, "c");
  assert.equal(question(2020, "Prelims", 51).suppliedExplanationIds, undefined);
  assert.equal(question(2020, "Prelims", 58).suppliedExplanationIds, undefined);
});

test("all four papers have a 200-mark maximum and one-third penalty", () => {
  for (const year of [2019, 2020]) for (const stage of ["Prelims", "CSAT"] as const) {
    const qs = paper(year, stage), s = session(qs);
    for (const q of qs) respond(s, q);
    const r = sessionReport(s, questionById);
    close(r.score, 200);
    assert.equal(r.incorrect, 0);
    assert.equal(r.unattempted, 0);
    for (const q of qs.filter(q => q.keyStatus !== "dropped")) close(q.negativeMarks!, q.marks / 3);
    assert.equal(Date.parse(s.deadline!) - Date.parse(s.startedAt), 120 * 60 * 1000);
  }
});

test("2020 GS dropped items neither score nor count as unanswered or mistakes", () => {
  const qs = paper(2020, "Prelims"), s = session(qs);
  const dropped = qs.filter(q => q.keyStatus === "dropped");
  assert.deepEqual(dropped.map(q => q.number), [42, 77]);
  respond(s, qs[0]);
  respond(s, qs[1], "a"); // Q2's official answer is D.
  for (const q of dropped) respond(s, q);
  const r = sessionReport(s, questionById);
  close(r.score, (200 / 98) * (1 - 1 / 3));
  assert.equal(r.attempted, 2);
  assert.equal(r.correct, 1);
  assert.equal(r.incorrect, 1);
  assert.equal(r.ungraded, 0);
  assert.equal(r.dropped, 2);
  assert.equal(r.unattempted, 96);
  assert.equal(r.accuracy, 50);
  assert.equal(Object.values(r.groups.subject).reduce((n, g) => n + g.attempted, 0), 2);
});

test("CSAT tables, shared passages and statement numbers survive transcription", () => {
  const table = question(2020, "CSAT", 18).blocks!.find(b => b.type === "table")!;
  assert.deepEqual(table.headers, ["Group", "Average marks in English", "Average marks in Hindi"]);
  assert.deepEqual(table.rows, [["Girls", "9", "8"], ["Boys", "8", "7"], ["Overall average marks", "8.8", "X"]]);
  assert.equal(question(2020, "CSAT", 52).blocks!.find(b => b.type === "table")!.rows!.at(-1)![0], "1971 - 1981");
  assert.equal(question(2020, "CSAT", 50).options.c, "(1/3)^(-4)");
  assert.match(question(2020, "CSAT", 58).question, /10\^n \+ 1/);
  assert.match(question(2020, "CSAT", 21).question, /5\. Substantial public investment/);
  for (const n of [48, 49, 50]) assert.ok(question(2019, "CSAT", n).blocks!.some(b => b.type === "passage" && b.text!.length > 100));
  for (const q of bank.filter(q => q.stage === "CSAT" && /above passage|author|critical message/i.test(q.question))) {
    assert.ok(q.blocks!.some(b => b.type === "passage" && b.text!.trim()), q.id);
  }
});

test("scaled and dropped key snapshots and reports round-trip through saved backups", () => {
  const d = createEmptyData(), qs = paper(2020, "Prelims"), s = session(qs);
  for (const q of [qs[0], qs[41], qs[76]]) {
    respond(s, q);
    d.pyqs.push(responseAttempt(q, s, s.responses[q.id], d.subjects));
  }
  s.endedAt = "2026-10-09T10:05:00Z";
  d.prelims = { ...emptyPrelims(), session: s, reports: [structuredClone(s)] };
  assert.equal(validateData(d), d);
  const values = new Map<string, string>();
  const oldStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) } });
  try {
    const repo = new LocalStorageRepository();
    repo.save(d);
    const restored = repo.load();
    assert.deepEqual(restored.prelims, d.prelims);
    assert.deepEqual(restored.pyqs, d.pyqs);
    close(sessionReport(restored.prelims!.reports![0], questionById).score, 200 / 98);
  } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: oldStorage }); }
});

test("invalid scaled snapshots are rejected while pinned scores remain stable", () => {
  const qs = paper(2020, "Prelims"), s = session(qs);
  respond(s, qs[0]);
  const w = { ...emptyPrelims(), session: s };
  for (const marks of [-1, 3.01, NaN, Infinity]) {
    const invalid = structuredClone(w); invalid.session.responses[qs[0].id].key!.marks = marks;
    assert.throws(() => validatePrelims(invalid), /Invalid saved key/);
  }
  const changedBank = new Map(questionById);
  changedBank.set(qs[0].id, { ...qs[0], answer: "d", marks: 1 });
  close(sessionReport(s, changedBank).score, 200 / 98);
});

test("existing 2025 papers and old saved sessions retain their IDs and scoring", () => {
  assert.deepEqual(originalBank.filter(q => q.year === 2025), previous2025);
  const qs = originalBank.filter(q => q.year === 2025 && q.stage === "Prelims"), s = session(qs);
  respond(s, qs[0]);
  respond(s, qs[1], qs[1].answer === "a" ? "b" : "a");
  close(sessionReport(s, questionById).score, 2 - 2 / 3);
  validatePrelims({ ...emptyPrelims(), session: JSON.parse(JSON.stringify(s)) });
});
