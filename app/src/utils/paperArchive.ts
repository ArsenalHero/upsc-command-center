import paperData from "../data/cse-paper-archive.json";

export interface ArchivedPaper {
  id: string; year: number; paper: "gs" | "csat"; title: string; booklet: string;
  questionCount: number; maximumMarks: number; minutes: number;
  paperUrl: string; officialPaperUrl: string; keyUrl: string; keyPage: number;
  keyPublisher: string; keySha256: string; verifiedOn: string;
  answers: string[]; droppedQuestions: number[];
}
export const archivedPapers = paperData as ArchivedPaper[];

export interface PaperAttempt {
  id: string; paperId: string; booklet: string; keySha256: string;
  mode: "practice" | "test"; startedAt: number; deadline?: number;
  completedAt?: number; answers: Record<string, string>; revealed: number[];
  review: number[]; current: number; keySnapshot: string[];
}

export function newPaperAttempt(paper: ArchivedPaper, mode: PaperAttempt["mode"], timed: boolean, now = Date.now()): PaperAttempt {
  return { id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`,
    paperId: paper.id, booklet: paper.booklet, keySha256: paper.keySha256,
    mode, startedAt: now, ...(mode === "test" && timed ? { deadline: now + paper.minutes * 60_000 } : {}),
    answers: {}, revealed: [], review: [], current: 1, keySnapshot: [...paper.answers] };
}

export function paperOutcome(key: string, choice = "") {
  if (key === "X") return "Dropped";
  if (!choice) return "Skipped";
  return key.includes(choice.toUpperCase()) ? "Right" : "Wrong";
}

export function paperScore(paper: ArchivedPaper, attempt: Pick<PaperAttempt, "answers" | "keySnapshot">) {
  const keys = attempt.keySnapshot;
  if (keys.length !== paper.questionCount || keys.some(k => !/^(?:[ABCD]{1,2}|X)$/.test(k))) throw new Error("The saved paper key is incomplete.");
  let correct = 0, incorrect = 0, skipped = 0, dropped = 0;
  keys.forEach((key, i) => {
    const outcome = paperOutcome(key, attempt.answers[String(i + 1)]);
    if (outcome === "Right") correct++;
    else if (outcome === "Wrong") incorrect++;
    else if (outcome === "Dropped") dropped++;
    else skipped++;
  });
  const scored = paper.questionCount - dropped, marks = paper.maximumMarks / scored;
  return { correct, incorrect, skipped, dropped, scored, marks, raw: correct * marks,
    penalty: incorrect * marks / 3, score: (correct - incorrect / 3) * marks,
    attempted: correct + incorrect, accuracy: correct + incorrect ? 100 * correct / (correct + incorrect) : null };
}

export function readPaperAttempts(raw: string | null): PaperAttempt[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Saved paper progress has an unsupported format.");
  return value.filter((item): item is PaperAttempt => {
    if (!item || typeof item !== "object") return false;
    const a = item as Partial<PaperAttempt>, paper = archivedPapers.find(p => p.id === a.paperId);
    if (!paper || typeof a.id !== "string" || a.booklet !== paper.booklet || !["practice", "test"].includes(a.mode || "")
      || !Number.isFinite(a.startedAt) || typeof a.keySha256 !== "string"
      || !Number.isInteger(a.current) || a.current! < 1 || a.current! > paper.questionCount
      || a.deadline !== undefined && !Number.isFinite(a.deadline)
      || a.completedAt !== undefined && !Number.isFinite(a.completedAt)
      || !Array.isArray(a.keySnapshot) || a.keySnapshot.length !== paper.questionCount
      || a.keySnapshot.some(k => typeof k !== "string" || !/^(?:[ABCD]{1,2}|X)$/.test(k))
      || !a.answers || typeof a.answers !== "object" || Array.isArray(a.answers)
      || Object.entries(a.answers).some(([n, choice]) => !/^\d+$/.test(n) || +n < 1 || +n > paper.questionCount || typeof choice !== "string" || !/^[ABCD]$/.test(choice))
      || !Array.isArray(a.revealed) || !Array.isArray(a.review)
      || [...a.revealed, ...a.review].some(n => !Number.isInteger(n) || n < 1 || n > paper.questionCount)) return false;
    return true;
  }).slice(-100);
}

export const paperAnswerLabel = (key: string) => key === "X" ? "Dropped by UPSC" : key.split("").join(" or ");
