import test from "node:test";
import assert from "node:assert/strict";
import { archivedPapers, archivedPaperQuestions } from "../src/utils/paperArchive";

test("every archived paper has its complete text, choices, final key and explanation in booklet order", () => {
  const ids = new Set<string>();
  for (const p of archivedPapers) {
    const qs = archivedPaperQuestions(p);
    assert.equal(qs.length, p.questionCount, p.id);
    qs.forEach((q, i) => {
      assert.equal(q.number, i + 1);
      assert.equal(q.year, p.year);
      assert.equal(q.booklet, p.booklet);
      assert.equal(q.stage, p.paper === "csat" ? "CSAT" : "Prelims");
      assert.ok(!ids.has(q.id)); ids.add(q.id);
      assert.deepEqual(Object.keys(q.options), ["a", "b", "c", "d"]);
      assert.ok(Object.values(q.options).every(s => s.trim().length && s.length < 450));
      assert.equal(q.answer, p.answers[i] === "X" ? null : p.answers[i].toLowerCase());
      assert.equal(q.keyStatus, p.answers[i] === "X" ? "dropped" : "official");
      assert.equal(q.keyUrl, p.keyUrl);
      assert.ok(q.question.length > 15);
      assert.ok(q.blocks?.length);
      assert.ok(q.explanation && q.explanation.justification.length > 80, q.id);
      for (const b of q.blocks || []) {
        if (b.type === "table") {
          assert.ok(b.headers?.length && b.rows?.length);
          assert.ok(b.rows?.every(row => row.length === b.headers!.length && row.every(Boolean)));
        }
        if (b.type === "passage") assert.ok(b.text!.length > 100);
      }
      assert.doesNotMatch(q.question + Object.values(q.options).join(" "), /©|vision\s*ias|Number of Qu|Section-wise|St t t|are t d/i);
    });
  }
  assert.equal(ids.size, 720);
});

test("shared CSAT passages and image-only tables were transcribed rather than omitted", () => {
  for (const p of archivedPapers.filter(p => p.paper === "csat")) {
    const qs = archivedPaperQuestions(p);
    assert.equal(qs.filter(q => q.blocks?.some(b => b.type === "passage")).length, 27);
  }
  const qs = archivedPaperQuestions(archivedPapers.find(p => p.year === 2021 && p.paper === "csat")!);
  assert.deepEqual(qs[16].blocks?.find(b => b.type === "table")?.rows, [["7B", "10A", "3C"], ["3C", "9B", "6A"], ["10A", "13C", "?"]]);
  assert.equal(qs[17].blocks?.find(b => b.type === "table")?.rows?.[0][6], "236.25");
  assert.deepEqual(qs[74].blocks?.find(b => b.type === "table")?.rows?.[1], ["B", "5", "12", "50", "85"]);
  const q22 = archivedPaperQuestions(archivedPapers.find(p => p.year === 2022 && p.paper === "csat")!);
  assert.match(q22[20].blocks![0].text!, /Agricultural technology/);
  assert.match(q22[41].blocks![0].text!, /excessive amount of labor/);
  assert.match(q22[42].blocks![0].text!, /demographic dividend/);
});

test("booklet rotations and mathematical notation match the selected original papers", () => {
  const get = (year: number, paper: string) => archivedPaperQuestions(archivedPapers.find(p => p.year === year && p.paper === paper)!);
  assert.match(get(2024, "gs")[0].question, /atmosphere/i);
  assert.match(get(2023, "gs")[0].question, /Jhelum/);
  assert.match(get(2021, "gs")[0].question, /wealth/i);
  assert.match(get(2024, "csat")[8].question, /1² × 2⁴ × 3⁶/);
  assert.match(get(2024, "csat")[53].question, /32⁵ \+ 2²⁷/);
  assert.deepEqual(get(2022, "csat")[8].options, { a: "2⁴⁰", b: "3²¹", c: "4¹⁸", d: "8¹²" });
  assert.match(get(2021, "csat")[34].question, /3²⁰¹⁹/);
  assert.match(get(2023, "csat")[24].question, /\(p\+c\)\/\(p−c\)/);
  assert.match(get(2023, "csat")[78].question, /10¹⁰th/);
  assert.match(get(2021, "csat")[8].explanation!.justification, /accepts both C and D/);
});
