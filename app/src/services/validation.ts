import type { AppData, Collection } from "../types";
import {
  studyTypes,
  errorTypes,
  revisionStages,
  topicStatuses,
} from "../types";
import { dateKey, parseDate } from "../utils/date";
export const collections: Collection[] = [
  "subjects",
  "topics",
  "sessions",
  "mcqs",
  "tests",
  "answers",
  "essays",
  "ethics",
  "currentAffairs",
  "pyqs",
  "revisions",
  "resources",
  "catalog",
  "goals",
];
const stages = ["Prelims", "Mains", "Both", "Optional", "CSAT"];
const strings: Record<Collection, string[]> = {
  subjects: ["id", "name", "stage", "paper", "color"],
  topics: [
    "id",
    "subjectId",
    "name",
    "status",
    "revisionStage",
    "notes",
    "createdAt",
  ],
  sessions: [
    "id",
    "date",
    "startTime",
    "endTime",
    "stage",
    "paper",
    "subjectId",
    "topicId",
    "subtopicId",
    "resourceId",
    "activity",
    "notes",
    "problems",
    "nextRevisionDate",
  ],
  mcqs: ["id", "date", "subjectId", "topicId", "stage", "notes"],
  tests: [
    "id",
    "date",
    "name",
    "seriesId",
    "subjectId",
    "topicId",
    "stage",
    "strongTopics",
    "weakTopics",
    "notes",
  ],
  answers: ["id", "date", "paper", "subjectId", "topicId", "question", "notes"],
  essays: ["id", "date", "topic", "category", "improvements"],
  ethics: [
    "id",
    "date",
    "topicId",
    "caseStudy",
    "stakeholders",
    "dilemma",
    "alternatives",
    "justification",
  ],
  currentAffairs: [
    "id",
    "date",
    "source",
    "subjectId",
    "topicId",
    "title",
    "notes",
    "staticLink",
  ],
  pyqs: [
    "id",
    "date",
    "stage",
    "paper",
    "subjectId",
    "topicId",
    "question",
    "conceptGap",
  ],
  revisions: [
    "id",
    "subjectId",
    "topicId",
    "dueDate",
    "completedDate",
    "stage",
    "notes",
  ],
  resources: ["id", "name", "subjectId", "topicId", "type", "url", "notes"],
  catalog: ["id", "name", "type", "subjectId", "notes"],
  goals: ["id", "name", "metric", "period", "subjectId"],
};
const numbers: Record<Collection, string[]> = {
  subjects: ["priority", "targetAllocation"],
  topics: ["importance"],
  sessions: [
    "plannedMinutes",
    "actualMinutes",
    "questionsPlanned",
    "questionsAttempted",
    "correct",
    "incorrect",
    "pyqs",
    "mainsAnswers",
    "mockScore",
    "maximumMarks",
    "focus",
    "energy",
    "difficulty",
    "distractionMinutes",
  ],
  mcqs: [
    "difficulty",
    "seen",
    "attempted",
    "correct",
    "incorrect",
    "minutes",
    "revisedErrors",
  ],
  tests: ["score", "maximum", "rank", "attempted", "correct"],
  answers: [
    "marks",
    "wordLimit",
    "minutes",
    "introduction",
    "body",
    "conclusion",
    "score",
  ],
  essays: [
    "words",
    "minutes",
    "introduction",
    "structure",
    "arguments",
    "examples",
    "multidimensionality",
    "conclusion",
    "mentorScore",
    "selfScore",
    "maximum",
  ],
  ethics: ["minutes", "structure", "score", "maximum"],
  currentAffairs: [],
  pyqs: ["year", "correct", "incorrect", "difficulty"],
  revisions: [],
  resources: [],
  catalog: [],
  goals: ["target"],
};
const booleans: Partial<Record<Collection, string[]>> = {
  sessions: ["revisionDone"],
  answers: ["examples", "data", "diagram", "articles", "reports"],
  currentAffairs: ["prelims", "mains", "revised"],
  pyqs: ["revisionNeeded"],
};
export const validDate = (s: unknown, empty = false): boolean =>
  typeof s === "string" &&
  ((empty && s === "") ||
    (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(parseDate(s).getTime()) &&
      dateKey(parseDate(s)) === s));
const obj = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
export function validateEntity(collection: Collection, v: unknown): void {
  assert(obj(v), `Invalid ${collection} record.`);
  const r = v as Record<string, any>;
  strings[collection].forEach((key) =>
    assert(
      typeof r[key] === "string" && r[key].length < 200000,
      `${collection}: invalid ${key}.`,
    ),
  );
  numbers[collection].forEach((key) =>
    assert(
      typeof r[key] === "number" &&
        Number.isFinite(r[key]) &&
        (key === "score" || key === "mockScore" || r[key] >= 0),
      `${collection}: invalid ${key}.`,
    ),
  );
  booleans[collection]?.forEach((key) =>
    assert(typeof r[key] === "boolean", `${collection}: invalid ${key}.`),
  );
  for (const key of ["name", "question", "caseStudy", "title"])
    if (key in r)
      assert(r[key].trim().length > 0, `${collection}: ${key} is required.`);
  assert(r.id && r.id.length < 200, `${collection}: missing identifier.`);
  if ("date" in r) assert(validDate(r.date), `${collection}: invalid date.`);
  if (r.demo !== undefined)
    assert(typeof r.demo === "boolean", `${collection}: invalid demo flag.`);
  if ("stage" in r)
    assert(
      (collection === "revisions" ? revisionStages : stages).includes(r.stage),
      `${collection}: invalid stage.`,
    );
  if ("difficulty" in r)
    assert(r.difficulty >= 1 && r.difficulty <= 5, "Difficulty must be 1–5.");
  if ("maximum" in r)
    assert(
      (r.maximum > 0 && r.score <= r.maximum) ||
        (collection === "essays" &&
          r.maximum > 0 &&
          r.mentorScore <= r.maximum &&
          r.selfScore <= r.maximum),
      "Score must not exceed a positive maximum.",
    );
  if (collection === "sessions") {
    assert(
      r.focus >= 1 && r.focus <= 10 && r.energy >= 1 && r.energy <= 10,
      "Focus and energy must be 1–10.",
    );
    assert(
      r.correct + r.incorrect <= r.questionsAttempted,
      "Correct + incorrect cannot exceed questions attempted.",
    );
    assert(
      r.actualMinutes <= 1440 &&
        r.plannedMinutes <= 1440 &&
        r.distractionMinutes <= 1440,
      "Minutes must be between 0 and 1440.",
    );
    assert(validDate(r.nextRevisionDate, true), "Invalid revision date.");
    assert(
      [r.startTime, r.endTime].every(
        (t) => t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t),
      ),
      "Invalid study time.",
    );
    assert(
      r.maximumMarks > 0 && r.mockScore <= r.maximumMarks,
      "Invalid mock marks.",
    );
  }
  if (collection === "mcqs") {
    assert(
      r.correct + r.incorrect === r.attempted,
      "Correct + incorrect must equal attempted MCQs.",
    );
    assert(
      r.seen >= r.attempted,
      "Questions seen cannot be less than attempted.",
    );
    assert(
      r.revisedErrors <= r.incorrect,
      "Revised errors cannot exceed incorrect answers.",
    );
  }
  if (collection === "mcqs" || collection === "tests") {
    assert(obj(r.errors), "Invalid error categories.");
    Object.entries(r.errors).forEach(([key, n]) =>
      assert(
        errorTypes.includes(key) &&
          typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0,
        "Invalid error count.",
      ),
    );
    if (collection === "mcqs")
      assert(
        Object.values<number>(r.errors).reduce((a, b) => a + b, 0) <=
          r.incorrect,
        "Error categories cannot exceed incorrect answers.",
      );
    if (collection === "tests")
      assert(r.correct <= r.attempted, "Correct cannot exceed attempted.");
  }
  if (collection === "answers")
    assert(
      r.marks > 0 && r.score <= r.marks,
      "Answer score must be at or below maximum marks.",
    );
  if (collection === "subjects")
    assert(
      r.priority >= 1 &&
        r.priority <= 5 &&
        r.targetAllocation <= 100 &&
        /^#[0-9a-fA-F]{6}$/.test(r.color) &&
        r.name.trim(),
      "Invalid subject settings.",
    );
  if (collection === "topics") {
    assert(
      topicStatuses.includes(r.status) &&
        revisionStages.includes(r.revisionStage) &&
        r.importance >= 1 &&
        r.importance <= 5 &&
        validDate(r.createdAt) &&
        r.name.trim(),
      "Invalid topic.",
    );
    assert(
      r.parentId === null || typeof r.parentId === "string",
      "Invalid topic parent.",
    );
    assert(
      Array.isArray(r.statusHistory) &&
        r.statusHistory.every(
          (h: any) =>
            obj(h) && validDate(h.date) && topicStatuses.includes(h.status),
        ),
      "Invalid topic status history.",
    );
  }
  if (collection === "revisions")
    assert(
      validDate(r.dueDate) && validDate(r.completedDate, true),
      "Invalid revision date.",
    );
  if (collection === "catalog")
    assert(
      [
        "Activity",
        "Course",
        "Coaching module",
        "Test series",
        "Category",
      ].includes(r.type),
      "Invalid catalog type.",
    );
  if (collection === "goals")
    assert(
      [
        "Hours",
        "MCQs",
        "Answers",
        "Essays",
        "Tests",
        "Revision",
        "Optional hours",
        "CSAT hours",
        "PYQs",
        "Syllabus %",
      ].includes(r.metric) &&
        ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"].includes(
          r.period,
        ) &&
        r.target > 0,
      "Invalid goal.",
    );
}
export function validateData(input: unknown): AppData {
  assert(obj(input), "Backup must be a JSON object.");
  const d = input as AppData;
  assert(
    d.schemaVersion === 1,
    "Unsupported backup version. Expected version 1.",
  );
  const s = d.settings;
  assert(obj(s), "Missing settings.");
  for (const key of [
    "year",
    "dailyHours",
    "weeklyHours",
    "monthlyHours",
    "mcqTarget",
    "answerTarget",
    "essayTarget",
    "revisionTarget",
    "testTarget",
    "pyqTarget",
    "optionalHours",
    "csatHours",
    "strengthThreshold",
    "weaknessThreshold",
    "minimumSample",
    "trendThreshold",
  ] as const)
    assert(
      typeof s[key] === "number" && Number.isFinite(s[key]) && s[key] >= 0,
      `Invalid setting: ${key}.`,
    );
  assert(
    s.dailyHours > 0 &&
      s.dailyHours <= 24 &&
      s.weeklyHours <= 168 &&
      s.year >= 2000 &&
      s.year <= 2200,
    "Invalid study targets or year.",
  );
  assert(
    s.weaknessThreshold < s.strengthThreshold &&
      s.strengthThreshold <= 100 &&
      s.minimumSample >= 1,
    "Check the strength/weakness thresholds and minimum sample.",
  );
  assert(
    validDate(s.prelimsDate, true) &&
      validDate(s.mainsDate, true) &&
      typeof s.optional === "string" &&
      ["light", "dark", "system"].includes(s.theme) &&
      typeof s.setupCompleted === "boolean",
    "Invalid personal settings.",
  );
  assert(
    obj(s.weights) && obj(s.allocation),
    "Missing scoring weights or allocations.",
  );
  for (const key of [
    "target",
    "focus",
    "accuracy",
    "revision",
    "questions",
    "answers",
  ] as const)
    assert(
      typeof s.weights[key] === "number" &&
        s.weights[key] >= 0 &&
        Number.isFinite(s.weights[key]),
      "Invalid productivity weights.",
    );
  assert(
    Object.values(s.weights).reduce((a, b) => a + b, 0) > 0,
    "Productivity weights must total more than zero.",
  );
  assert(
    Object.keys(s.allocation).length > 0 &&
      Object.values(s.allocation).every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      ) &&
      Math.abs(Object.values(s.allocation).reduce((a, b) => a + b, 0) - 100) <
        0.1,
    "Target allocations must total 100%.",
  );
  collections.forEach((c) => {
    assert(Array.isArray(d[c]), `Missing ${c} collection.`);
    assert(d[c].length <= 100000, "A collection exceeds 100,000 records.");
    const ids = new Set<string>();
    d[c].forEach((r) => {
      validateEntity(c, r);
      assert(!ids.has(r.id), `Duplicate identifier in ${c}.`);
      ids.add(r.id);
    });
  });
  const subjects = new Set(d.subjects.map((s) => s.id)),
    topics = new Map(d.topics.map((t) => [t.id, t])),
    resources = new Set(d.resources.map((r) => r.id)),
    series = new Set(
      d.catalog.filter((c) => c.type === "Test series").map((c) => c.id),
    );
  collections.forEach((c) =>
    d[c].forEach((r: any) => {
      if (r.resourceId)
        assert(
          resources.has(r.resourceId),
          `${c} references a missing resource.`,
        );
      if (r.seriesId)
        assert(
          series.has(r.seriesId),
          `${c} references a missing test series.`,
        );
      if (r.subjectId)
        assert(subjects.has(r.subjectId), `${c} references a missing subject.`);
      for (const field of ["topicId", "subtopicId"])
        if (r[field]) {
          assert(topics.has(r[field]), `${c} references a missing topic.`);
          if (r.subjectId)
            assert(
              topics.get(r[field])?.subjectId === r.subjectId,
              `${c}: topic and subject do not match.`,
            );
        }
    }),
  );
  d.topics.forEach((t) => {
    const visited = new Set<string>([t.id]);
    let parent = t.parentId;
    while (parent) {
      const p = topics.get(parent);
      assert(p && p.subjectId === t.subjectId, "Invalid parent topic.");
      assert(!visited.has(parent), "Topic hierarchy contains a cycle.");
      visited.add(parent);
      parent = p!.parentId;
    }
  });
  return d;
}
