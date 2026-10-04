import type {
  AppData,
  PYQDraft,
  PYQRecord,
  Subject,
  MCQRecord,
} from "../types";
import { dateKey, uid } from "./date";

export interface StudyExplanation {
  justification: string; concept: string;
  statements?: { label: string; verdict: string; reason: string }[];
  options?: Record<string, string>;
  references: { title: string; url: string; section?: string }[];
  insight?: string; elimination?: string; relatedConcepts?: string[];
}
export interface ExplanationReview {
  status: "referenced" | "disputed";
  reviewedOn: string;
  issue?: string;
  answer?: string | null;
  explanation: StudyExplanation;
}
export interface PYQQuestion {
  id: string;
  year: number;
  stage: "Prelims" | "Mains" | "CSAT";
  paper: string;
  number: number;
  booklet: string;
  questionType?: "MCQ";
  negativeMarks?: number;
  examOccurrences?: { group: "UPSC CSE" | "State PSC" | "CDS & CAPF"; name: string; state: string; year: number; stage: string; label: string }[];
  sourceFile?: string;
  sourcePart?: number;
  sourceQuestionNumber?: number;
  sourceSha256?: string;
  sourceTitle?: string;
  sourceNotes?: string;
  sourceVariants?: PYQQuestion[];
  subjectMemberships?: { subject: string; topic: string }[];
  keyConflict?: boolean;
  explanationReview?: ExplanationReview;
  explanationSourceId?: string;
  suppliedAnswer?: string | null;
  subject: string;
  topic: string;
  question: string;
  options: Record<string, string>;
  answer: string | null;
  keyStatus: "official" | "provided" | "pending" | "dropped";
  marks: number;
  wordLimit: number;
  sourceUrl: string;
  keyUrl: string;
  page: number;
  subtopic?: string;
  difficultyLabel?: "Easy" | "Moderate" | "Difficult";
  verification?: "verified" | "required";
  blocks?: { type: "paragraph" | "list" | "table" | "passage"; text?: string; items?: string[]; headers?: string[]; rows?: string[][] }[];
  explanation?: StudyExplanation;
  sourceImage?: string;
  imageSlices?: {
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  }[];
}
export const formatSeconds = (seconds: number) => {
  const n = Math.max(0, Math.floor(seconds));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
};
export class ActiveTimer {
  private elapsed: number;
  private started: number | null = null;
  constructor(seconds = 0) {
    this.elapsed = seconds * 1000;
  }
  start(now: number) {
    if (this.started === null) this.started = now;
  }
  pause(now: number) {
    if (this.started !== null) this.elapsed += Math.max(0, now - this.started);
    this.started = null;
  }
  seconds(now: number) {
    return Math.min(
      86400,
      Math.max(
        0,
        this.elapsed + (this.started === null ? 0 : now - this.started),
      ) / 1000,
    );
  }
}
export function newDraft(ids: string[], sessionId: string = uid()): PYQDraft {
  return {
    sessionId,
    questionIds: ids,
    index: 0,
    seconds: 0,
    selectedOption: "",
    confidence: 3,
    difficulty: 3,
    errorType: "",
    notes: "",
    response: "",
    selfScore: "",
    selfOutcome: "",
    revisionNeeded: false,
  };
}
export function nextDraft(draft: PYQDraft): PYQDraft {
  return {
    ...newDraft(draft.questionIds, draft.sessionId),
    index: draft.index + 1,
  };
}
export function bankSubjectId(q: PYQQuestion, subjects: Subject[]): string {
  return (
    (
      subjects.find((s) => s.name === q.subject) ??
      subjects.find((s) => s.paper === q.paper)
    )?.id || ""
  );
}
export function makeAttempt(
  q: PYQQuestion,
  draft: PYQDraft,
  subjects: Subject[],
  skip = false,
  now = new Date(),
): PYQRecord {
  const choice = skip ? "" : draft.selectedOption;
  const response = skip ? "" : draft.response.trim();
  let outcome: NonNullable<PYQRecord["attempt"]>["outcome"] = "ungraded";
  let grading: NonNullable<PYQRecord["attempt"]>["grading"] = "none";
  if (skip) outcome = "skipped";
  else if (q.stage === "Mains" && q.questionType !== "MCQ") {
    if (!response)
      throw new Error("Write an answer before saving, or skip this question.");
    outcome = "written";
    grading = draft.selfScore === "" ? "none" : "self";
  } else {
    if (!choice)
      throw new Error(
        "Choose an option before submitting, or skip this question.",
      );
    if ((q.keyStatus === "official" || q.keyStatus === "provided") && q.answer) {
      outcome = choice === q.answer ? "correct" : "incorrect";
      grading = q.keyStatus;
    } else if (q.keyStatus === "pending" && draft.selfOutcome) {
      outcome = draft.selfOutcome;
      grading = "self";
    }
  }
  const selfScore =
    !skip && q.stage === "Mains" && q.questionType !== "MCQ" && draft.selfScore !== ""
      ? Number(draft.selfScore)
      : null;
  if (
    selfScore !== null &&
    (!Number.isFinite(selfScore) || selfScore < 0 || selfScore > q.marks)
  )
    throw new Error(`Self-assessed marks must be between 0 and ${q.marks}.`);
  return {
    id: `${draft.sessionId}-${draft.index}`,
    date: dateKey(now),
    year: q.year,
    stage: q.stage,
    paper: q.paper,
    subjectId: bankSubjectId(q, subjects),
    topicId: "",
    question: q.question,
    correct: Number(outcome === "correct"),
    incorrect: Number(outcome === "incorrect"),
    difficulty: draft.difficulty,
    conceptGap: draft.notes,
    revisionNeeded: draft.revisionNeeded || outcome === "incorrect",
    attempt: {
      questionId: q.id,
      sessionId: draft.sessionId,
      questionNumber: q.number,
      booklet: q.booklet,
      attemptedAt: now.toISOString(),
      selectedOption: choice,
      answerOption: q.answer || "",
      outcome,
      grading,
      seconds: Math.round(draft.seconds * 10) / 10,
      confidence: draft.confidence,
      errorType: draft.errorType,
      notes: draft.notes,
      response,
      selfScore,
      maximum: q.marks,
      sourceUrl: q.sourceUrl,
      ...(q.sourceFile ? {
        sourceFile: q.sourceFile,
        examGroup: q.examOccurrences?.[0]?.group || "Unlabelled",
        examName: q.examOccurrences?.[0]?.name || "Not supplied",
        examState: q.examOccurrences?.[0]?.state || "",
        examStage: q.examOccurrences?.[0]?.stage || "Not supplied",
        examLabels: q.examOccurrences?.map(e => e.label).join("; ") || "Not supplied",
      } : {}),
    },
  };
}
export function latestAttempts(records: PYQRecord[]): Map<string, PYQRecord> {
  const map = new Map<string, PYQRecord>();
  records
    .filter((r) => r.attempt)
    .forEach((r) => {
      const old = map.get(r.attempt!.questionId);
      if (!old || r.attempt!.attemptedAt >= old.attempt!.attemptedAt)
        map.set(r.attempt!.questionId, r);
    });
  return map;
}
export function attemptStats(records: PYQRecord[]) {
  const attempts = records.filter((r) => r.attempt);
  const graded = attempts.filter((r) =>
    ["correct", "incorrect"].includes(r.attempt!.outcome),
  );
  const count = (outcome: string) =>
    attempts.filter((r) => r.attempt!.outcome === outcome).length;
  const correct = count("correct"),
    incorrect = count("incorrect");
  const seconds = attempts.reduce((sum, r) => sum + r.attempt!.seconds, 0);
  return {
    total: attempts.length,
    unique: new Set(attempts.map((r) => r.attempt!.questionId)).size,
    correct,
    incorrect,
    skipped: count("skipped"),
    ungraded: count("ungraded"),
    written: count("written"),
    accuracy: graded.length ? (correct / graded.length) * 100 : null,
    seconds,
    averageSeconds: attempts.length ? seconds / attempts.length : null,
    flagged: latestAttempts(attempts).size
      ? [...latestAttempts(attempts).values()].filter((r) => r.revisionNeeded)
          .length
      : 0,
    selfMarked: graded.filter((r) => r.attempt!.grading === "self").length,
  };
}
export function attemptMCQs(
  data: AppData,
): (MCQRecord & { paper: string; activity: "PYQ" })[] {
  return data.pyqs
    .filter(
      (p) => p.attempt && ["correct", "incorrect"].includes(p.attempt.outcome),
    )
    .map((p) => ({
      id: p.id,
      date: p.date,
      subjectId: p.subjectId,
      topicId: p.topicId,
      stage: p.stage,
      difficulty: p.difficulty,
      paper: p.paper,
      activity: "PYQ",
      seen: 1,
      attempted: 1,
      correct: p.correct,
      incorrect: p.incorrect,
      minutes: p.attempt!.seconds / 60,
      errors:
        p.incorrect && p.attempt!.errorType
          ? { [p.attempt!.errorType]: 1 }
          : {},
      notes: p.attempt!.notes,
      revisedErrors: p.revisionNeeded ? 0 : p.incorrect,
    }));
}
