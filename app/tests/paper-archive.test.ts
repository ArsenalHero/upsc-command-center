import test from "node:test";
import assert from "node:assert/strict";
import { archivedPapers, newPaperAttempt, paperAnswerLabel, paperOutcome, paperScore, readPaperAttempts } from "../src/utils/paperArchive";

test("the complete 2021–2024 archive covers both papers with the verified booklet", () => {
  const expected = [
    [2024, "gs", "A", [20, 52, 57]], [2024, "csat", "A", []],
    [2023, "gs", "A", [34]], [2023, "csat", "B", []],
    [2022, "gs", "A", [61]], [2022, "csat", "A", [36]],
    [2021, "gs", "C", [30]], [2021, "csat", "B", []],
  ];
  assert.deepEqual(archivedPapers.map(p => [p.year, p.paper, p.booklet, p.droppedQuestions]), expected);
  assert.equal(new Set(archivedPapers.map(p => p.id)).size, 8);
  assert.equal(archivedPapers.reduce((n, p) => n + p.questionCount, 0), 720);
  assert.equal(archivedPapers.reduce((n, p) => n + p.answers.filter(k => k !== "X").length, 0), 713);
  for (const p of archivedPapers) {
    assert.equal(p.questionCount, p.paper === "gs" ? 100 : 80);
    assert.equal(p.answers.length, p.questionCount);
    assert.deepEqual(p.answers.flatMap((key, i) => key === "X" ? [i + 1] : []), p.droppedQuestions);
    assert.ok(p.answers.every(k => /^(?:[ABCD]|CD|X)$/.test(k)));
    assert.match(p.officialPaperUrl, /^https:\/\/www\.upsc\.gov\.in\//);
    assert.equal(p.keyPublisher, "Union Public Service Commission");
    assert.match(p.keySha256, /^[a-f0-9]{64}$/);
  }
});

test("scoring excludes dropped items and applies the one-third penalty without rounding each answer", () => {
  for (const p of archivedPapers) {
    const run = newPaperAttempt(p, "practice", false, 1000);
    p.answers.forEach((k, i) => { run.answers[String(i + 1)] = k === "X" ? "A" : k[0]; });
    const allRight = paperScore(p, run);
    assert.ok(Math.abs(allRight.score - 200) < 1e-10);
    assert.equal(allRight.correct, p.questionCount - p.droppedQuestions.length);
    assert.equal(allRight.dropped, p.droppedQuestions.length);
    p.answers.forEach((k, i) => { run.answers[String(i + 1)] = ["A", "B", "C", "D"].find(c => !k.includes(c))!; });
    assert.ok(Math.abs(paperScore(p, run).score + 200 / 3) < 1e-10);
    const ids = p.answers.flatMap((k, i) => k !== "X" ? [i] : []).slice(0, 4);
    run.answers = Object.fromEntries(ids.map((i, index) => [String(i + 1), index === 0 ? p.answers[i][0] : ["A", "B", "C", "D"].find(c => !p.answers[i].includes(c))!]));
    const cancellation = paperScore(p, run);
    assert.equal(cancellation.correct, 1); assert.equal(cancellation.incorrect, 3);
    assert.ok(Math.abs(cancellation.score) < 1e-10);
    run.answers = {};
    assert.equal(paperScore(p, run).score, 0);
    assert.equal(paperScore(p, run).accuracy, null);
  }
});

test("the 2021 CSAT Series B key accepts C or D at question 9", () => {
  const p = archivedPapers.find(p => p.year === 2021 && p.paper === "csat")!;
  assert.equal(p.answers[8], "CD");
  assert.equal(paperAnswerLabel(p.answers[8]), "C or D");
  for (const answer of ["C", "D"]) {
    const run = newPaperAttempt(p, "test", false);
    run.answers["9"] = answer;
    assert.equal(paperScore(p, run).correct, 1);
  }
  assert.equal(paperOutcome("CD", "A"), "Wrong");
  assert.equal(paperOutcome("X", "A"), "Dropped");
  assert.equal(paperOutcome("C"), "Skipped");
});

test("saved attempts keep their original key even when the archive key later changes", () => {
  const p = archivedPapers[0], run = newPaperAttempt(p, "practice", false);
  run.answers["1"] = p.answers[0];
  const changed = { ...p, answers: p.answers.map(k => k === "A" ? "B" : "A") };
  assert.equal(paperScore(changed, run).correct, 1);
  assert.deepEqual(readPaperAttempts(JSON.stringify([run])), [run]);
  assert.throws(() => paperScore(p, { ...run, keySnapshot: [] }), /incomplete/);
});

test("only timed tests receive a two-hour deadline", () => {
  const p = archivedPapers[0];
  assert.equal(newPaperAttempt(p, "test", true, 1000).deadline, 7_201_000);
  assert.equal(newPaperAttempt(p, "practice", true, 1000).deadline, undefined);
  assert.equal(newPaperAttempt(p, "test", false, 1000).deadline, undefined);
});

test("saved progress validation rejects malformed or out-of-range answers", () => {
  const run = newPaperAttempt(archivedPapers[0], "practice", false);
  assert.deepEqual(readPaperAttempts(null), []);
  assert.throws(() => readPaperAttempts("{"));
  assert.throws(() => readPaperAttempts("{}"), /format/);
  for (const invalid of [
    { ...run, answers: { "101": "A" } }, { ...run, answers: { "1": "AB" } },
    { ...run, current: 0 }, { ...run, booklet: "B" },
    { ...run, review: [101] }, { ...run, keySnapshot: ["A"] },
    { ...run, completedAt: "yesterday" },
  ]) assert.equal(readPaperAttempts(JSON.stringify([invalid])).length, 0);
});
