import type { AppData, Collection, PYQDraft, PrelimsWorkspace, LectureWorkspace, BookWorkspace } from "../types";
import {
  studyTypes,
  errorTypes,
  revisionStages,
  topicStatuses,
} from "../types";
import { dateKey, parseDate } from "../utils/date";
import { validRepetitionDays, validPresetStep } from "../utils/revision";
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
  if (collection === "pyqs" && r.attempt !== undefined) {
    const a = r.attempt;
    assert(obj(a), "Invalid question attempt.");
    for (const key of [
      "questionId",
      "sessionId",
      "booklet",
      "attemptedAt",
      "selectedOption",
      "answerOption",
      "outcome",
      "grading",
      "errorType",
      "notes",
      "response",
      "sourceUrl",
    ])
      assert(
        typeof a[key] === "string" && a[key].length < 200000,
        `Invalid attempt ${key}.`,
      );
    assert(
      a.questionId &&
        a.sessionId &&
        a.questionId.length < 200 &&
        a.sessionId.length < 200,
      "Missing question or practice session.",
    );
    assert(
      Number.isInteger(a.questionNumber) &&
        a.questionNumber > 0 &&
        a.questionNumber <= 1000,
      "Invalid question number.",
    );
    assert(
      Number.isFinite(Date.parse(a.attemptedAt)) && a.attemptedAt.length <= 40,
      "Invalid attempt timestamp.",
    );
    assert(
      ["", "a", "b", "c", "d", "e"].includes(a.selectedOption) &&
        ["", "a", "b", "c", "d", "e"].includes(a.answerOption),
      "Invalid answer option.",
    );
    assert(
      ["correct", "incorrect", "skipped", "ungraded", "written"].includes(
        a.outcome,
      ) && ["official", "provided", "self", "none"].includes(a.grading),
      "Invalid marking result.",
    );
    assert(
      Number.isFinite(a.seconds) && a.seconds >= 0 && a.seconds <= 86400,
      "Question time must be between 0 and 24 hours.",
    );
    assert(
      Number.isInteger(a.confidence) && a.confidence >= 1 && a.confidence <= 5,
      "Confidence must be 1–5.",
    );
    assert(
      a.errorType === "" || errorTypes.includes(a.errorType),
      "Invalid mistake category.",
    );
    assert(
      Number.isFinite(a.maximum) &&
        (a.maximum > 0 ||
          (a.maximum === 0 && a.grading === "none" && !a.answerOption &&
            ["ungraded", "skipped"].includes(a.outcome) && a.selfScore === null)) &&
        (a.selfScore === null ||
          (Number.isFinite(a.selfScore) &&
            a.selfScore >= 0 &&
            a.selfScore <= a.maximum)),
      "Invalid self-assessed marks.",
    );
    assert(
      r.correct === Number(a.outcome === "correct") &&
        r.incorrect === Number(a.outcome === "incorrect"),
      "Question result does not match its counts.",
    );
    assert(
      (a.outcome !== "correct" && a.outcome !== "incorrect") ||
        (a.selectedOption && a.grading !== "none"),
      "A marked MCQ needs a selected option and marking basis.",
    );
    if (
      ["official", "provided"].includes(a.grading) &&
      ["correct", "incorrect"].includes(a.outcome)
    )
      assert(
        a.answerOption &&
          (a.selectedOption === a.answerOption) === (a.outcome === "correct"),
        "Result does not match the official key.",
      );
    if (a.outcome === "skipped")
      assert(
        a.selectedOption === "" && a.response === "",
        "A skipped question cannot contain an answer.",
      );
    assert(
      !a.sourceUrl || /^https:\/\//.test(a.sourceUrl),
      "Invalid paper source.",
    );
    for (const field of ["sourceFile", "examGroup", "examName", "examState", "examStage", "examLabels"]) assert(a[field] === undefined || (typeof a[field] === "string" && a[field].length < 2000), "Invalid saved exam metadata.");
  }
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
  if (collection === "revisions") {
    assert(
      validDate(r.dueDate) && validDate(r.completedDate, true),
      "Invalid revision date.",
    );
    if (r.repeatOf !== undefined)
      assert(typeof r.repeatOf === "string" && r.repeatOf.length > 0 && r.repeatOf.length <= 2000 && r.repeatOf !== r.id, "Invalid spaced repetition source.");
    if (r.repetitionStep !== undefined)
      assert(validPresetStep(r.repetitionStep), "Invalid preset review step.");
  }
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
  if (d.prelims !== undefined) validatePrelims(d.prelims);
  if (d.pyqDraft !== undefined) validatePYQDraft(d.pyqDraft);
  assert(
    d.schemaVersion === 1,
    "Unsupported backup version. Expected version 1.",
  );
  const s = d.settings;
  assert(obj(s), "Missing settings.");
  if (s.spacedRepetition !== undefined)
    assert(obj(s.spacedRepetition) && typeof s.spacedRepetition.enabled === "boolean" && validRepetitionDays(s.spacedRepetition.days)
      && (s.spacedRepetition.mode === undefined || ["preset", "custom"].includes(s.spacedRepetition.mode)), "Spaced repetition needs a preset or custom mode, an on/off setting and a whole number from 1 to 365 days.");
  assert(s.examType === undefined || ["UPSC CSE", "State PSC"].includes(s.examType), "Choose UPSC CSE or State PSC.");
  assert(s.statePscName === undefined || (typeof s.statePscName === "string" && s.statePscName.length <= 120), "State PSC exam name must be at most 120 characters.");
  assert(s.statePscDate === undefined || validDate(s.statePscDate, true), "Invalid State PSC exam date.");
  if (s.examType === "State PSC")
    assert(typeof s.statePscName === "string" && s.statePscName.trim().length > 0 && validDate(s.statePscDate), "Enter the State PSC exam name and exam date.");
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
  if (d.lectures !== undefined) validateLectures(d.lectures, subjects);
  if (d.books !== undefined) validateBooks(d.books, subjects);
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
export function validatePYQDraft(d: PYQDraft): void {
  assert(
    obj(d) &&
      typeof d.sessionId === "string" &&
      d.sessionId.length > 0 &&
      d.sessionId.length < 200,
    "Invalid practice session.",
  );
  assert(
    Array.isArray(d.questionIds) &&
      d.questionIds.length > 0 &&
      d.questionIds.length <= 1000 &&
      d.questionIds.every(
        (id) => typeof id === "string" && id.length > 0 && id.length < 200,
      ) &&
      new Set(d.questionIds).size === d.questionIds.length,
    "Invalid practice questions.",
  );
  assert(
    Number.isInteger(d.index) &&
      d.index >= 0 &&
      d.index <= d.questionIds.length,
    "Invalid practice position.",
  );
  assert(
    Number.isFinite(d.seconds) && d.seconds >= 0 && d.seconds <= 86400,
    "Invalid practice timer.",
  );
  assert(
    ["", "a", "b", "c", "d", "e"].includes(d.selectedOption) &&
      ["", "correct", "incorrect"].includes(d.selfOutcome),
    "Invalid practice choice.",
  );
  assert(
    Number.isInteger(d.confidence) &&
      d.confidence >= 1 &&
      d.confidence <= 5 &&
      Number.isInteger(d.difficulty) &&
      d.difficulty >= 1 &&
      d.difficulty <= 5,
    "Invalid confidence or difficulty.",
  );
  for (const key of ["errorType", "notes", "response", "selfScore"] as const)
    assert(
      typeof d[key] === "string" && d[key].length < 200000,
      `Invalid practice ${key}.`,
    );
  assert(
    (d.errorType === "" || errorTypes.includes(d.errorType)) &&
      typeof d.revisionNeeded === "boolean",
    "Invalid practice review details.",
  );
}

export function validatePrelims(p: PrelimsWorkspace): void {
  assert(obj(p), "Invalid Prelims workspace.");
  assert(p.autoAdvance === undefined || typeof p.autoAdvance === "boolean", "Invalid automatic next-question preference.");
  const ids = (a: unknown) => Array.isArray(a) && a.length <= 10000 && new Set(a).size === a.length && a.every(x => typeof x === "string" && x.length > 0 && x.length < 200);
  const filters = (f: unknown) => {
    assert(obj(f), "Invalid PYQ filters."); const v = f as Record<string, unknown>;
    for (const k of ["paper", "subject", "topic", "difficulty", "status", "query"]) assert(typeof v[k] === "string" && (v[k] as string).length < 1000, "Invalid PYQ filter.");
    assert(v.subtopic === undefined || (typeof v.subtopic === "string" && v.subtopic.length < 1000), "Invalid PYQ subtopic.");
    for (const k of ["year", "examGroup", "state", "exam", "examStage"]) assert(v[k] === undefined || (typeof v[k] === "string" && (v[k] as string).length < 1000), "Invalid PYQ exam filter.");
  };
  filters(p.filters); assert(ids(p.bookmarks) && ids(p.review), "Invalid bookmarks or review flags.");
  if (p.reports !== undefined) {
    assert(Array.isArray(p.reports) && p.reports.length <= 1000 && new Set(p.reports.map(r => r.id)).size === p.reports.length, "Invalid or duplicate session reports.");
    for (const report of p.reports) { assert(!!report.endedAt, "A saved report must be complete."); validatePrelims({ filters: p.filters, bookmarks: [], review: [], session: report }); }
  }
  if (!p.session) return; const s = p.session;
  assert(obj(s) && typeof s.id === "string" && s.id.length > 0 && s.id.length < 200 && ["practice", "test"].includes(s.mode), "Invalid PYQ session.");
  assert(ids(s.questionIds) && s.questionIds.length > 0 && s.questionIds.length <= 10000 && Number.isInteger(s.index) && s.index >= 0 && s.index < s.questionIds.length, "Invalid question position.");
  assert(typeof s.startedAt === "string", "Missing start time.");
  for (const d of [s.startedAt, s.endedAt, s.deadline]) assert(d === undefined || (typeof d === "string" && d.length < 40 && Number.isFinite(Date.parse(d))), "Invalid session date.");
  filters(s.filters); assert(obj(s.responses) && Object.keys(s.responses).length <= s.questionIds.length, "Invalid responses.");
  for (const [id, r] of Object.entries(s.responses)) {
    assert(s.questionIds.includes(id) && obj(r), "Unknown question response.");
    assert(["", "a", "b", "c", "d", "e"].includes(r.option) && Number.isFinite(r.seconds) && r.seconds >= 0 && r.seconds <= 86400, "Invalid answer or time.");
    assert(Number.isInteger(r.confidence) && r.confidence >= 1 && r.confidence <= 5, "Invalid confidence.");
    assert(["submitted", "visited", "review"].every(k => typeof (r as unknown as Record<string, unknown>)[k] === "boolean"), "Invalid question flags.");
    assert(typeof r.notes === "string" && r.notes.length < 200000 && typeof r.errorType === "string" && (!r.errorType || errorTypes.includes(r.errorType)), "Invalid review notes.");
    // Complete papers can scale marks after UPSC drops items. Retain these
    // exact key snapshots, including zero marks for dropped questions.
    if (r.key) assert(obj(r.key) && ["official", "provided", "pending", "dropped"].includes(r.key.status) && (r.key.answer === null || ["a", "b", "c", "d", "e"].includes(r.key.answer)) && Number.isFinite(r.key.marks) && r.key.marks >= 0 && r.key.marks <= 3 && (r.key.marks > 0 || r.key.status === "dropped") && (!["official", "provided"].includes(r.key.status) || !!r.key.answer) && (r.key.negativeMarks === undefined || (Number.isFinite(r.key.negativeMarks) && r.key.negativeMarks >= 0 && r.key.negativeMarks <= r.key.marks)), "Invalid saved key.");
  }
}

export function validateLectures(w: LectureWorkspace, subjects: Set<string>): void {
  assert(obj(w) && Array.isArray(w.plans) && Array.isArray(w.logs), "Invalid lecture workspace.");
  assert(w.plans.length <= 1000 && w.logs.length <= 100000, "Too many lecture records.");
  const plans = new Set<string>(), usedSubjects = new Set<string>(), logs = new Set<string>(), days = new Set<string>();
  const id = (value: unknown) => typeof value === "string" && value.length > 0 && value.length < 200;
  for (const p of w.plans) {
    assert(obj(p) && id(p.id) && !plans.has(p.id), "Invalid or duplicate lecture target.");
    assert(subjects.has(p.subjectId) && !usedSubjects.has(p.subjectId), "Choose a valid subject with one lecture target per subject.");
    assert(typeof p.course === "string" && p.course.length <= 200 && validDate(p.dueDate, true), "Invalid lecture course or deadline.");
    assert(Number.isInteger(p.target) && p.target > 0 && p.target <= 10000, "Lecture targets must be whole numbers from 1 to 10,000.");
    assert(Number.isInteger(p.dailyTarget) && p.dailyTarget >= 0 && p.dailyTarget <= 100, "Daily lecture targets must be whole numbers from 0 to 100.");
    plans.add(p.id); usedSubjects.add(p.subjectId);
  }
  for (const l of w.logs) {
    assert(obj(l) && id(l.id) && !logs.has(l.id) && plans.has(l.planId), "Invalid or duplicate lecture log.");
    assert(validDate(l.date) && !days.has(`${l.planId}:${l.date}`), "Keep one daily entry per lecture subject; edit the existing entry to change its total.");
    assert(Number.isInteger(l.completed) && l.completed >= 1 && l.completed <= 1000, "Daily completions must be whole numbers from 1 to 1,000.");
    assert(Number.isInteger(l.minutes) && l.minutes >= 0 && l.minutes <= 1440 && typeof l.notes === "string" && l.notes.length <= 10000, "Invalid lecture duration or notes.");
    logs.add(l.id); days.add(`${l.planId}:${l.date}`);
  }
}
export function validateBooks(w: BookWorkspace, subjects: Set<string>): void {
  assert(obj(w) && Array.isArray(w.plans) && Array.isArray(w.logs), "Invalid book workspace.");
  assert(w.plans.length <= 1000 && w.logs.length <= 100000, "Too many book records.");
  const plans = new Map<string, number>(), logIds = new Set<string>();
  const id = (value: unknown) => typeof value === "string" && value.length > 0 && value.length < 200;
  for (const p of w.plans) {
    assert(obj(p) && id(p.id) && !plans.has(p.id), "Invalid or duplicate book.");
    assert(typeof p.title === "string" && p.title.trim().length > 0 && p.title.length <= 200, "Enter a book title of at most 200 characters.");
    assert(typeof p.author === "string" && p.author.length <= 120 && typeof p.edition === "string" && p.edition.length <= 120, "Invalid book author or edition.");
    assert(subjects.has(p.subjectId), "Choose a valid book subject.");
    assert(Number.isInteger(p.totalChapters) && p.totalChapters >= 1 && p.totalChapters <= 1000, "Total chapters must be a whole number from 1 to 1,000.");
    assert(Number.isInteger(p.revisionTarget) && p.revisionTarget >= 0 && p.revisionTarget <= 50, "Revision target must be a whole number from 0 to 50.");
    plans.set(p.id, p.totalChapters);
  }
  const readDates = new Map<string, Map<number, string>>();
  for (const l of w.logs) {
    assert(obj(l) && id(l.id) && !logIds.has(l.id) && plans.has(l.bookId), "Invalid or duplicate book progress entry.");
    assert(validDate(l.date) && l.date <= dateKey(), "Book progress needs a valid date on or before today.");
    assert(["reading", "revision"].includes(l.kind), "Choose reading or revision.");
    assert(Array.isArray(l.chapters) && l.chapters.length > 0 && l.chapters.length <= plans.get(l.bookId)!
      && new Set(l.chapters).size === l.chapters.length
      && l.chapters.every(n => Number.isInteger(n) && n >= 1 && n <= plans.get(l.bookId)!), "Chapter numbers must be unique and within this book's total. Keep the total at least as high as your recorded chapters.");
    assert(Number.isInteger(l.repeats) && l.repeats >= 1 && l.repeats <= 1000 && (l.kind !== "reading" || l.repeats === 1), "Revisions must be a whole number from 1 to 1,000; first reading is counted once.");
    assert(typeof l.notes === "string" && l.notes.length <= 5000, "Book notes must be at most 5,000 characters.");
    logIds.add(l.id);
    if (l.kind === "reading") {
      const dates = readDates.get(l.bookId) || new Map<number, string>();
      for (const n of l.chapters) if (!dates.has(n) || l.date < dates.get(n)!) dates.set(n, l.date);
      readDates.set(l.bookId, dates);
    }
  }
  for (const l of w.logs) if (l.kind === "revision")
    assert(l.chapters.every(n => !!readDates.get(l.bookId)?.get(n) && readDates.get(l.bookId)!.get(n)! <= l.date), "Record these chapters as read on or before the revision date. Remove or correct related revision entries before removing their reading history.");
}
