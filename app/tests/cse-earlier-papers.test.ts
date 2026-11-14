import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import additions from "../src/data/cse-2015-2018-bank";
import catalog from "../docs/CSE-2015-2018-IMPORT.json";
import { questionById } from "../src/data/questionBank";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { validateData } from "../src/services/validation";
import { LocalStorageRepository } from "../src/services/repository";
import type { PYQQuestion } from "../src/utils/pyq";

const bank = additions as PYQQuestion[];
const paper = (year: number, stage: "Prelims" | "CSAT") => bank.filter(q => q.year === year && q.stage === stage);
const session = (qs: PYQQuestion[]) => startSession(qs, "test", emptyFilters(), true, new Date("2026-10-09T10:00:00Z"));
const respond = (s: ReturnType<typeof session>, q: PYQQuestion, option = q.answer || "a") => {
  s.responses[q.id] = { ...emptyResponse(), option, submitted: true, seconds: 30, key: keySnapshot(q) };
};
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("2015–2018 contain eight complete papers in their verified booklet order", () => {
  assert.equal(bank.length, 720);
  assert.equal(new Set(bank.map(q => q.id)).size, 720);
  assert.equal(catalog.papers.length, 8);
  const booklets = { "2015-Prelims": "C", "2015-CSAT": "C", "2016-Prelims": "A", "2016-CSAT": "A", "2017-Prelims": "A", "2017-CSAT": "A", "2018-Prelims": "C", "2018-CSAT": "A" };
  for (const p of catalog.papers) {
    const qs = paper(p.year, p.stage as "Prelims" | "CSAT");
    assert.equal(qs.length, p.stage === "CSAT" ? 80 : 100);
    assert.deepEqual(qs.map(q => q.number), Array.from({ length: qs.length }, (_, i) => i + 1));
    assert.deepEqual(qs.map(q => q.answer?.toUpperCase() || "X"), p.answers);
    assert.equal(p.booklet, booklets[`${p.year}-${p.stage}` as keyof typeof booklets]);
    for (const q of qs) {
      assert.equal(q.booklet, p.booklet);
      assert.deepEqual(Object.keys(q.options), ["a", "b", "c", "d"]);
      assert.ok(Object.values(q.options).every(v => v.trim()), q.id);
      assert.ok(q.question.trim(), q.id);
      assert.ok(q.explanation?.justification || q.suppliedExplanationIds?.length, q.id);
      assert.equal(questionById.get(q.id)?.answer, q.answer, q.id);
      assert.equal(questionById.get(q.id)?.keyStatus, q.keyStatus, q.id);
    }
  }
  // Independently read from the final UPSC 2015 CSAT Series C key (page 3).
  const csat2015 = "A D A B C D C B B C C D B A A A C C C D A D B C C A A D D A A A C D B D C B A B D D A C C A A C C A B B B C D D D B B C B D C B B D B D C D X A B C D D C C C B".split(" ");
  assert.deepEqual(paper(2015, "CSAT").map(q => q.answer?.toUpperCase() || "X"), csat2015);
  const csat2018 = paper(2018, "CSAT");
  assert.equal(csat2018[1].answer, "d"); assert.equal(csat2018[1].options.d, "8");
  assert.equal(csat2018[65].answer, "a"); assert.equal(csat2018[69].answer, "b");
  const race = paper(2016, "CSAT")[77];
  assert.equal(race.answer, "d"); assert.equal(race.options.c, "75 m"); assert.equal(race.options.d, "150 m");
  const ruleOfLaw = paper(2018, "Prelims")[98];
  assert.equal(ruleOfLaw.answer, "d"); assert.equal(ruleOfLaw.options.d, "World Justice Project");
});

test("all eight papers score out of 200 with one-third penalties and two-hour tests", () => {
  for (const year of [2015, 2016, 2017, 2018]) for (const stage of ["Prelims", "CSAT"] as const) {
    const qs = paper(year, stage), s = session(qs);
    for (const q of qs) respond(s, q);
    const r = sessionReport(s, questionById);
    close(r.score, 200);
    assert.equal(r.incorrect, 0); assert.equal(r.unattempted, 0);
    assert.equal(r.attempted, year === 2015 && stage === "CSAT" ? 79 : qs.length);
    assert.equal(Date.parse(s.deadline!) - Date.parse(s.startedAt), 7200000);
    for (const q of qs.filter(q => q.keyStatus !== "dropped")) close(q.negativeMarks!, q.marks / 3);
  }
});

test("2015 CSAT question 71 is excluded and the other 79 items retain scaled marks", () => {
  const qs = paper(2015, "CSAT"), s = session(qs);
  assert.deepEqual(bank.filter(q => q.keyStatus === "dropped").map(q => [q.year, q.stage, q.number]), [[2015, "CSAT", 71]]);
  respond(s, qs[0]); respond(s, qs[1], "a"); respond(s, qs[70]);
  const r = sessionReport(s, questionById);
  close(r.score, (200 / 79) * (1 - 1 / 3));
  assert.equal(r.attempted, 2); assert.equal(r.correct, 1); assert.equal(r.incorrect, 1);
  assert.equal(r.dropped, 1); assert.equal(r.unattempted, 77); assert.equal(r.accuracy, 50);
  assert.equal(Object.values(r.groups.subject).reduce((n, g) => n + g.attempted, 0), 2);
  assert.equal(qs[70].marks, 0); assert.equal(qs[70].answer, null);
});

test("every reading item includes its passage and every diagram has a local accessible asset", () => {
  for (const year of [2015, 2016, 2017, 2018]) {
    assert.ok(paper(year, "CSAT").some(q => q.blocks?.some(b => b.type === "passage")), String(year));
  }
  for (const q of bank.filter(q => q.stage === "CSAT" && /above passage|author|critical message/i.test(q.question))) {
    assert.ok(q.blocks?.some(b => b.type === "passage" && b.text!.trim().length > 40), q.id);
  }
  const table2018 = paper(2018, "CSAT")[73].blocks!.find(b => b.type === "table")!;
  assert.equal(table2018.rows!.length, 18);
  assert.deepEqual(table2018.rows![3], ["State 4", "545", "9.78", "5.94"]);
  assert.deepEqual(table2018.rows!.at(-1), ["State 18", "599", "7.49", "47.84"]);
  assert.ok(bank.some(q => q.sourceImage));
  for (const q of bank.filter(q => q.sourceImage)) {
    assert.ok(q.sourceImageAlt?.trim(), q.id);
    assert.match(q.sourceImage!, /^\.\/paper-figures\/[a-z0-9-]+\.png$/);
    const bytes = readFileSync(new URL(`../public/${q.sourceImage!.slice(2)}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", q.id);
    assert.ok(bytes.length < 140000, `${q.id} figure bundle size`);
  }
});

test("2015 scaled responses, zero-mark dropped attempts and reports survive backup reload", () => {
  const d = createEmptyData(), qs = paper(2015, "CSAT"), s = session(qs);
  for (const q of [qs[0], qs[70]]) {
    respond(s, q);
    d.pyqs.push(responseAttempt(q, s, s.responses[q.id], d.subjects));
  }
  s.endedAt = "2026-10-09T10:05:00Z";
  d.prelims = { ...emptyPrelims(), session: s, reports: [structuredClone(s)] };
  validateData(d);
  const values = new Map<string, string>(), oldStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) } });
  try {
    const repo = new LocalStorageRepository(); repo.save(d);
    const restored = repo.load();
    assert.deepEqual(restored.prelims, d.prelims); assert.deepEqual(restored.pyqs, d.pyqs);
    close(sessionReport(restored.prelims!.reports![0], questionById).score, 200 / 79);
  } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: oldStorage }); }
});
