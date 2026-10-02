import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createEmptyData } from "../src/data/defaults";
import {
  ActiveTimer,
  attemptStats,
  latestAttempts,
  makeAttempt,
  newDraft,
  nextDraft,
  type PYQQuestion,
} from "../src/utils/pyq";
import { aggregate, getStreak, studyTrend } from "../src/utils/analytics";
import { validateData, validatePYQDraft } from "../src/services/validation";
import { buildCSV } from "../src/services/export";
import { dateKey } from "../src/utils/date";

const bank: PYQQuestion[] = JSON.parse(
  readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"),
);
const subjects = createEmptyData().subjects;
const official = bank.find((q) => q.keyStatus === "official")!;
const pending = bank.find(
  (q) => q.stage === "Prelims" && q.keyStatus === "pending",
)!;
const dropped = bank.find((q) => q.keyStatus === "dropped")!;
const mains = bank.find((q) => q.stage === "Mains")!;
const today = dateKey();
const draft = (q: PYQQuestion, session = "practice") => ({
  ...newDraft([q.id], session),
  seconds: 60,
  selectedOption: q.answer || "a",
});

test("bank has complete numbered papers and local original images with valid crops", () => {
  assert.equal(bank.length, 220);
  assert.equal(new Set(bank.map((q) => q.id)).size, 220);
  for (const [year, stage, count] of [
    [2024, "Prelims", 100],
    [2025, "Prelims", 100],
    [2025, "Mains", 20],
  ] as const) {
    const qs = bank.filter((q) => q.year === year && q.stage === stage);
    assert.deepEqual(
      qs.map((q) => q.number).sort((a, b) => a - b),
      Array.from({ length: count }, (_, i) => i + 1),
    );
  }
  assert.deepEqual(
    bank.filter((q) => q.keyStatus === "dropped").map((q) => q.number),
    [20, 52, 57],
  );
  for (const q of bank) {
    assert.ok(q.question.trim().length > 10);
    assert.ok(
      subjects.some((s) => s.name === q.subject),
      q.subject,
    );
    if (q.stage === "Mains") {
      assert.equal(q.marks, q.number <= 10 ? 10 : 15);
      assert.equal(q.wordLimit, q.number <= 10 ? 150 : 250);
    } else {
      assert.ok(q.imageSlices?.length, q.id);
      assert.equal(q.booklet, "A");
      for (const s of q.imageSlices!) {
        assert.ok(
          existsSync(new URL(`../public/${s.url}`, import.meta.url)),
          s.url,
        );
        const image = readFileSync(new URL(`../public/${s.url}`, import.meta.url));
        assert.ok(image.length > 1000, `Empty or incomplete paper image: ${s.url}`);
        assert.equal(image.subarray(0, 4).toString(), "RIFF");
        assert.equal(image.subarray(8, 12).toString(), "WEBP");
        assert.ok(s.x >= 0 && s.y >= 0 && s.width > 0 && s.height > 0);
        assert.ok(
          s.x + s.width <= s.imageWidth + 2 &&
            s.y + s.height <= s.imageHeight + 2,
          q.id,
        );
      }
    }
    assert.equal(q.keyStatus === "official", q.answer !== null);
  }
});

test("official marking snapshots choice, key, review fields and automatically flags wrong answers", () => {
  const correct = makeAttempt(official, draft(official), subjects);
  assert.equal(correct.attempt!.outcome, "correct");
  assert.equal(correct.attempt!.grading, "official");
  const wrong = makeAttempt(
    official,
    {
      ...draft(official),
      selectedOption: official.answer === "a" ? "b" : "a",
      confidence: 2,
      difficulty: 5,
      errorType: "Conceptual",
      notes: "Review the concept",
    },
    subjects,
  );
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.incorrect, 1);
  assert.equal(wrong.revisionNeeded, true);
  assert.equal(wrong.attempt!.answerOption, official.answer);
  assert.equal(wrong.attempt!.confidence, 2);
  assert.equal(wrong.attempt!.notes, "Review the concept");
  const data = createEmptyData();
  data.pyqs = [wrong];
  validateData(data);
});

test("pending and dropped keys cannot invent official results; skipping preserves only time", () => {
  const unmarked = makeAttempt(pending, draft(pending), subjects);
  assert.equal(unmarked.attempt!.outcome, "ungraded");
  const selfMarked = makeAttempt(
    pending,
    { ...draft(pending), selfOutcome: "correct" },
    subjects,
  );
  assert.equal(selfMarked.attempt!.grading, "self");
  const cancelled = makeAttempt(
    dropped,
    { ...draft(dropped), selfOutcome: "correct" },
    subjects,
  );
  assert.equal(cancelled.attempt!.outcome, "ungraded");
  const skipped = makeAttempt(
    official,
    { ...draft(official), response: "unsaved" },
    subjects,
    true,
  );
  assert.equal(skipped.attempt!.selectedOption, "");
  assert.equal(skipped.attempt!.response, "");
  assert.equal(skipped.attempt!.seconds, 60);
  assert.equal(attemptStats([unmarked, cancelled, skipped]).accuracy, null);
  assert.throws(
    () => makeAttempt(official, newDraft([official.id]), subjects),
    /Choose an option/,
  );
});

test("Mains stores a written answer with optional bounded self-assessed marks", () => {
  const written = makeAttempt(
    mains,
    { ...draft(mains), response: "A written answer.", selfScore: "7.5" },
    subjects,
  );
  assert.equal(written.attempt!.outcome, "written");
  assert.equal(written.attempt!.grading, "self");
  assert.equal(written.attempt!.selfScore, 7.5);
  assert.equal(written.correct + written.incorrect, 0);
  assert.throws(
    () =>
      makeAttempt(
        mains,
        { ...draft(mains), response: "Answer", selfScore: "11" },
        subjects,
      ),
    /between 0 and 10/,
  );
  assert.throws(
    () => makeAttempt(mains, draft(mains), subjects),
    /Write an answer/,
  );
});

test("timer counts monotonic active intervals, ignoring paused or hidden elapsed time", () => {
  const timer = new ActiveTimer(12.5);
  timer.start(1000);
  timer.start(2000);
  assert.equal(timer.seconds(4500), 16);
  timer.pause(5000);
  timer.pause(9000);
  assert.equal(timer.seconds(60000), 16.5);
  timer.start(60000);
  assert.equal(timer.seconds(62500), 19);
  timer.pause(62500);
  assert.equal(timer.seconds(90000), 19);
  assert.equal(new ActiveTimer(999999).seconds(0), 86400);
});

test("repeat attempts remain separate while latest status and revision flags follow the latest attempt", () => {
  const wrong = makeAttempt(
    official,
    {
      ...draft(official, "first"),
      selectedOption: official.answer === "a" ? "b" : "a",
    },
    subjects,
    false,
    new Date("2026-10-01T09:00:00Z"),
  );
  const right = makeAttempt(
    official,
    draft(official, "second"),
    subjects,
    false,
    new Date("2026-10-01T10:00:00Z"),
  );
  const stats = attemptStats([right, wrong]);
  assert.equal(stats.total, 2);
  assert.equal(stats.unique, 1);
  assert.equal(stats.accuracy, 50);
  assert.equal(stats.flagged, 0);
  assert.equal(latestAttempts([right, wrong]).get(official.id)?.id, right.id);
});

test("backup round trip preserves the active draft, all attempts and CSV question parameters", () => {
  const data = createEmptyData();
  data.pyqs = [makeAttempt(official, draft(official), subjects)];
  data.pyqDraft = {
    ...newDraft([official.id, pending.id]),
    index: 1,
    seconds: 32.1,
    selectedOption: "c",
    notes: "Come back to this",
  };
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.pyqDraft!.seconds, 32.1);
  assert.equal(restored.pyqs[0].attempt!.selectedOption, official.answer);
  const csv = buildCSV(restored, "pyqs");
  for (const field of [
    "questionId",
    "seconds",
    "confidence",
    "selectedOption",
    "answerOption",
    "outcome",
    "grading",
    "errorType",
  ])
    assert.ok(csv.split("\r\n")[0].includes(`"${field}"`));
  assert.equal(validateData(createEmptyData()).schemaVersion, 1);
  assert.throws(
    () => validatePYQDraft({ ...data.pyqDraft!, index: 3 }),
    /position/,
  );
  assert.throws(
    () => validatePYQDraft({ ...data.pyqDraft!, seconds: -1 }),
    /timer/,
  );
  assert.equal(nextDraft(data.pyqDraft!).selectedOption, "");
  assert.equal(nextDraft(data.pyqDraft!).seconds, 0);
});

test("dashboard, daily trend and activity filters count each saved attempt once and exclude unmarked results from accuracy", () => {
  const data = createEmptyData();
  data.pyqs = [
    makeAttempt(official, draft(official, "graded"), subjects),
    makeAttempt(pending, draft(pending, "pending"), subjects),
    makeAttempt(official, draft(official, "skip"), subjects, true),
    makeAttempt(
      mains,
      { ...draft(mains, "written"), response: "My answer", selfScore: "5" },
      subjects,
    ),
  ];
  const stats = aggregate(data, today, today);
  assert.equal(data.mcqs.length, 0);
  assert.equal(stats.hours, 0.1);
  assert.equal(stats.attempted, 2);
  assert.equal(stats.gradedQuestions, 1);
  assert.equal(stats.accuracy, 100);
  assert.equal(stats.answers, 1);
  assert.equal(stats.answerScore, 50);
  assert.equal(stats.pyqs, 3);
  assert.equal(stats.studyDays, 1);
  assert.equal(getStreak(data, today), 1);
  const trend = studyTrend(data, today, today)[0];
  assert.equal(trend.actual, stats.hours);
  assert.equal(trend.questions, stats.attempted);
  assert.equal(trend.answers, 1);
  assert.equal(
    aggregate(data, today, today, "", { activity: "PYQ" }).attempted,
    2,
  );
  assert.equal(
    aggregate(data, today, today, "", { activity: "MCQ" }).attempted,
    0,
  );
  assert.equal(
    aggregate(data, today, today, "", { paper: official.paper }).correct,
    1,
  );
});
