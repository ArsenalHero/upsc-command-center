import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { createDemoData } from "../src/data/demo";
import {
  aggregate,
  coverage,
  getStreak,
  insights,
  subjectStats,
  allocationCategory,
  goalValue,
} from "../src/utils/analytics";
import { validateData } from "../src/services/validation";
import { csvCell, buildCSV } from "../src/services/export";
import { dateKey, addDays, periodBounds } from "../src/utils/date";
import {
  LocalStorageRepository,
  STORAGE_KEY,
} from "../src/services/repository";
import type { MCQRecord, StudySession } from "../src/types";
const today = dateKey();
const mcq = (
  id: string,
  attempted: number,
  correct: number,
  subjectId = "subject-3",
): MCQRecord => ({
  id,
  date: today,
  subjectId,
  topicId: "",
  stage: "Prelims",
  difficulty: 3,
  seen: attempted,
  attempted,
  correct,
  incorrect: attempted - correct,
  minutes: attempted,
  errors: {},
  notes: "",
  revisedErrors: 0,
});
const session = (id: string, date = today): StudySession => ({
  id,
  date,
  startTime: "09:00",
  endTime: "10:00",
  stage: "Both",
  paper: "Prelims GS",
  subjectId: "subject-3",
  topicId: "topic-3-4",
  subtopicId: "",
  resourceId: "",
  activity: "MCQ",
  plannedMinutes: 60,
  actualMinutes: 60,
  questionsPlanned: 10,
  questionsAttempted: 10,
  correct: 8,
  incorrect: 2,
  pyqs: 0,
  mainsAnswers: 0,
  revisionDone: false,
  mockScore: 0,
  maximumMarks: 200,
  focus: 8,
  energy: 7,
  difficulty: 3,
  distractionMinutes: 0,
  notes: "",
  problems: "",
  nextRevisionDate: "",
});
test("empty and fictional demo data both pass complete backup validation", () => {
  assert.equal(validateData(createEmptyData()).schemaVersion, 1);
  const d = createDemoData();
  assert.ok(d.sessions.length > 400);
  assert.equal(validateData(d), d);
  assert.ok(insights(d, addDays(today, -29), today).length > 0);
});
test("MCQ accuracy is weighted by question count, not by practice-set percentages", () => {
  const d = createEmptyData();
  d.mcqs = [mcq("a", 10, 10), mcq("b", 90, 45)];
  const a = aggregate(d, today, today);
  assert.equal(a.accuracy, 55);
  assert.equal(a.attempted, 100);
});
test("linked MCQ records do not double-count question totals", () => {
  const d = createEmptyData();
  d.sessions = [session("session")];
  d.mcqs = [{ ...mcq("set", 10, 8), studySessionId: "session" }];
  const a = aggregate(d, today, today);
  assert.equal(a.attempted, 10);
  assert.equal(a.correct, 8);
  assert.equal(a.hours, 1);
});
test("activity filters preserve question totals in linked PYQ sessions", () => {
  const d = createEmptyData();
  d.sessions = [{ ...session("session"), activity: "PYQ", pyqs: 10 }];
  d.mcqs = [{ ...mcq("set", 10, 8), studySessionId: "session" }];
  assert.equal(
    aggregate(d, today, today, "", { activity: "PYQ" }).attempted,
    10,
  );
  assert.equal(
    aggregate(d, today, today, "", { activity: "MCQ" }).attempted,
    0,
  );
});
test("parent-topic queries include descendant practice and study sessions", () => {
  const d = createEmptyData();
  d.sessions = [{ ...session("a"), topicId: "parliament-0" }];
  assert.equal(
    aggregate(d, today, today, "", { topicId: "topic-3-4" }).hours,
    1,
  );
});
test("on-time revision health differs from completion when work is late", () => {
  const d = createEmptyData();
  d.revisions = [
    {
      id: "a",
      subjectId: "subject-3",
      topicId: "topic-3-4",
      dueDate: addDays(today, -2),
      completedDate: today,
      stage: "Revision 1",
      notes: "",
    },
    {
      id: "b",
      subjectId: "subject-3",
      topicId: "topic-3-4",
      dueDate: addDays(today, -2),
      completedDate: addDays(today, -2),
      stage: "Revision 1",
      notes: "",
    },
  ];
  const a = aggregate(d, addDays(today, -7), today);
  assert.equal(a.revisionCompletion, 100);
  assert.equal(a.revisionHealth, 50);
  assert.equal(a.revisions, 2);
});
test("study hours alone cannot make a subject strong or weak", () => {
  const d = createEmptyData();
  d.sessions = [
    {
      ...session("a"),
      actualMinutes: 600,
      questionsAttempted: 0,
      correct: 0,
      incorrect: 0,
    },
  ];
  const s = subjectStats(d, today, today).find(
    (s) => s.subject.id === "subject-3",
  )!;
  assert.equal(s.status, "Needs data");
});
test("weakness needs two low indicators and a sufficient MCQ sample", () => {
  const d = createEmptyData();
  d.mcqs = [mcq("a", 10, 2)];
  assert.equal(
    subjectStats(d, today, today).find((s) => s.subject.id === "subject-3")!
      .status,
    "Needs data",
  );
  d.mcqs = [mcq("a", 100, 20)];
  assert.equal(
    subjectStats(d, today, today).find((s) => s.subject.id === "subject-3")!
      .status,
    "Weak",
  );
});
test("coverage measures leaves and uses historical status snapshots", () => {
  const d = createEmptyData();
  d.topics = d.topics.filter((t) => t.id === "parliament-0");
  d.topics[0].parentId = null;
  d.topics[0].createdAt = addDays(today, -20);
  d.topics[0].status = "Completed";
  d.topics[0].statusHistory = [
    { date: addDays(today, -20), status: "Not Started" },
    { date: addDays(today, -10), status: "In Progress" },
    { date: today, status: "Completed" },
  ];
  assert.equal(coverage(d, "", addDays(today, -11)), 0);
  assert.equal(coverage(d, "", addDays(today, -1)), 50);
  assert.equal(coverage(d, "", today), 100);
});
test("productivity score exposes the exact components and weights used", () => {
  const d = createEmptyData();
  d.sessions = [session("a")];
  const a = aggregate(d, today, today);
  const parts = a.productivityParts;
  assert.ok(parts.length > 0);
  const calculated = Number(
    (
      parts.reduce((n, p) => n + p.value * p.weight, 0) /
      parts.reduce((n, p) => n + p.weight, 0)
    ).toFixed(1),
  );
  assert.equal(a.productivity, calculated);
  assert.equal(
    parts.some((p) => p.key === "revision"),
    false,
  );
});
test("streak can continue through yesterday, and skips zero-minute records", () => {
  const d = createEmptyData();
  d.sessions = [
    session("a", addDays(today, -1)),
    session("b", addDays(today, -2)),
    { ...session("c", today), actualMinutes: 0 },
  ];
  assert.equal(getStreak(d), 2);
});
test("custom subjects and activities flow into analytics and allocation", () => {
  const d = createEmptyData();
  d.subjects.push({
    id: "custom",
    name: "My Optional",
    stage: "Optional",
    paper: "Paper I",
    color: "#3158eb",
    priority: 5,
    targetAllocation: 20,
  });
  d.sessions = [
    {
      ...session("a"),
      subjectId: "custom",
      topicId: "",
      stage: "Optional",
      questionsAttempted: 0,
      correct: 0,
      incorrect: 0,
    },
  ];
  assert.equal(aggregate(d, today, today, "custom").optionalHours, 1);
  d.settings.allocation = { GS: 90, "Map practice": 10 };
  d.sessions[0].activity = "Map practice";
  assert.equal(allocationCategory(d, d.sessions[0]), "Map practice");
});
test("CSAT warning counts actual study days and does not predict exam outcomes", () => {
  const d = createEmptyData();
  d.sessions = Array.from({ length: 8 }, (_, i) =>
    session(String(i), addDays(today, -i)),
  );
  const i = insights(d, addDays(today, -8), today).find(
    (i) => i.id === "csat-neglect",
  );
  assert.match(i!.observation, /8 study days/);
  assert.doesNotMatch(JSON.stringify(i), /will clear|chance of selection/i);
});
test("invalid dates, topic cycles, impossible scores, and MCQ counts are rejected", () => {
  let d = createEmptyData();
  d.mcqs = [{ ...mcq("a", 10, 8), date: "2026-02-31" }];
  assert.throws(() => validateData(d));
  d = createEmptyData();
  d.topics[0].parentId = d.topics[0].id;
  assert.throws(() => validateData(d), /cycle/);
  d = createEmptyData();
  d.mcqs = [{ ...mcq("a", 10, 8), incorrect: 10 }];
  assert.throws(() => validateData(d), /equal attempted/);
  d = createEmptyData();
  d.settings.allocation = { GS: 80 };
  assert.throws(() => validateData(d), /100%/);
});
test("CSV cells escape quotes and neutralize spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=SUM(A1:A2)"), `"'=SUM(A1:A2)"`);
  const d = createEmptyData();
  d.mcqs = [mcq("a", 10, 8)];
  assert.ok(buildCSV(d, "mcqs").includes("Polity & Governance"));
});
test("repository survives reload and preserves corrupt bytes", () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) || null,
      setItem: (k: string, v: string) => memory.set(k, v),
    },
  });
  const r = new LocalStorageRepository();
  const d = createEmptyData();
  d.mcqs = [mcq("a", 10, 8)];
  r.save(d);
  assert.equal(new LocalStorageRepository().load().mcqs.length, 1);
  memory.set(STORAGE_KEY, "invalid json");
  assert.throws(() => r.load(), /preserved/);
  assert.equal(memory.get(STORAGE_KEY), "invalid json");
});
test("calendar periods use local date keys and quarter boundaries", () => {
  assert.deepEqual(periodBounds("Weekly", "2026-10-02"), [
    "2026-09-28",
    "2026-10-04",
  ]);
  assert.deepEqual(periodBounds("Monthly", "2026-02-20"), [
    "2026-02-01",
    "2026-02-28",
  ]);
  assert.deepEqual(periodBounds("Quarterly", "2026-10-02"), [
    "2026-10-01",
    "2026-12-31",
  ]);
});
