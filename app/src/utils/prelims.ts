import type { PrelimsFilters, PrelimsResponse, PrelimsSession, PrelimsWorkspace, PYQRecord, Subject } from "../types";
import { uid } from "./date";
import { makeAttempt, newDraft, type PYQQuestion } from "./pyq";
import { examOccurrences, matchesExam } from "./exams";
import { matchesSubject, questionTopics } from "./questionCollections";

export const emptyFilters = (): PrelimsFilters => ({ paper: "", subject: "", topic: "", subtopic: "", difficulty: "", status: "", query: "", year: "", examGroup: "", state: "", exam: "", examStage: "" });
export const emptyPrelims = (): PrelimsWorkspace => ({ filters: emptyFilters(), bookmarks: [], review: [] });
export const emptyResponse = (): PrelimsResponse => ({ option: "", seconds: 0, confidence: 3, errorType: "", notes: "", submitted: false, visited: true, review: false });
export const keySnapshot = (q: PYQQuestion) => ({ answer: q.answer, status: q.keyStatus, marks: q.marks, negativeMarks: q.negativeMarks ?? q.marks / 3 });
export function startSession(qs: PYQQuestion[], mode: "practice" | "test", filters: PrelimsFilters, timed = false, now = new Date()): PrelimsSession {
  if (!qs.length || qs.length > 5000) throw new Error("Choose between 1 and 5,000 questions.");
  return { id: uid(), mode, questionIds: qs.map(q => q.id), index: 0, responses: { [qs[0].id]: emptyResponse() }, filters: { ...filters }, startedAt: now.toISOString(), ...(timed ? { deadline: new Date(now.getTime() + 7200000).toISOString() } : {}) };
}
export function responseAttempt(q: PYQQuestion, s: PrelimsSession, r: PrelimsResponse, subjects: Subject[], now = new Date()): PYQRecord {
  const d = { ...newDraft(s.questionIds, s.id), index: s.questionIds.indexOf(q.id), seconds: r.seconds, selectedOption: r.option, confidence: r.confidence, notes: r.notes, errorType: r.errorType, revisionNeeded: r.review, difficulty: q.difficultyLabel === "Easy" ? 1 : q.difficultyLabel === "Difficult" ? 5 : 3 };
  const saved = r.key ? { ...q, answer: r.key.answer, keyStatus: r.key.status, marks: r.key.marks, negativeMarks: r.key.negativeMarks ?? q.negativeMarks } : q;
  const record = makeAttempt(saved, d, subjects, !r.option, now); record.attempt!.sessionMode = s.mode; record.revisionNeeded = r.review;
  if (q.sourceFile) {
    const e = examOccurrences(q).find(e => (!s.filters.examGroup || e.group === s.filters.examGroup) && (!s.filters.state || e.state === s.filters.state) && (!s.filters.exam || e.name === s.filters.exam) && (!s.filters.examStage || e.stage === s.filters.examStage) && (!s.filters.year || String(e.year || "unknown") === s.filters.year)) || examOccurrences(q)[0];
    record.year = e.year;
    record.stage = e.stage === "Mains" ? "Mains" : "Prelims";
    record.paper = `${e.name} · ${q.subject === "Polity & Governance" ? "Polity" : q.subject} MCQs`;
    Object.assign(record.attempt!, { examGroup: e.group, examName: e.name, examState: e.state, examStage: e.stage });
  }
  return record;
}
export function sessionReport(s: PrelimsSession, bank: Map<string, PYQQuestion>) {
  let correct = 0, incorrect = 0, ungraded = 0, attempted = 0, raw = 0, penalty = 0, seconds = 0;
  const groups: Record<string, Record<string, { attempted: number; correct: number; incorrect: number; seconds: number }>> = { subject: {}, topic: {}, difficultyLabel: {} };
  for (const id of s.questionIds) {
    const q = bank.get(id), r = s.responses[id]; if (!q) continue;
    const key = r?.key || keySnapshot(q), time = r?.seconds || 0;
    seconds += time;
    const graded = ["official", "provided"].includes(key.status) && !!key.answer;
    const right = !!r?.option && graded && r.option === key.answer;
    const wrong = !!r?.option && graded && !right;
    if (r?.option) { attempted++; if (right) { correct++; raw += key.marks; } else if (wrong) { incorrect++; penalty += key.negativeMarks ?? key.marks / 3; } else ungraded++; }
    for (const name of ["subject", "topic", "difficultyLabel"] as const) {
      const group = groups[name][q[name] || "Unclassified"] ||= { attempted: 0, correct: 0, incorrect: 0, seconds: 0 };
      group.attempted += +!!r?.option; group.correct += +right; group.incorrect += +wrong; group.seconds += time;
    }
  }
  return { total: s.questionIds.length, attempted, correct, incorrect, ungraded, unattempted: s.questionIds.length - attempted, raw, penalty, score: raw - penalty, seconds, accuracy: correct + incorrect ? 100 * correct / (correct + incorrect) : null, groups };
}
export function filterQuestions(bank: PYQQuestion[], f: PrelimsFilters, latest: Map<string, PYQRecord>, bookmarks: string[], review: string[]) {
  const terms = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return bank.filter(q => {
    if (!matchesExam(q, f)) return false;
    if ((f.paper && q.paper !== f.paper) || !matchesSubject(q, f.subject) || (f.topic && !questionTopics(q, f.subject).includes(f.topic)) || (f.subtopic && q.subtopic !== f.subtopic) || (f.difficulty && q.difficultyLabel !== f.difficulty)) return false;
    const a = latest.get(q.id)?.attempt;
    if (f.status === "attempted" && !a?.selectedOption) return false;
    if (f.status === "unattempted" && a?.selectedOption) return false;
    if (["correct", "incorrect", "skipped"].includes(f.status) && a?.outcome !== f.status) return false;
    if (f.status === "bookmarked" && !bookmarks.includes(q.id)) return false;
    if (f.status === "review" && !review.includes(q.id) && !latest.get(q.id)?.revisionNeeded) return false;
    return terms.every(t => [q.year, q.paper, q.number, ...questionSubjectsForSearch(q), q.subtopic, q.sourceFile, ...(q.examOccurrences || []).flatMap(e => [e.label, e.name, e.state, e.year]), q.question, ...Object.values(q.options), ...(q.blocks || []).flatMap(b => [b.text || "", ...(b.items || []), ...(b.rows || []).flat()]), ...(q.sourceVariants || []).flatMap(copy => [copy.sourceFile, copy.number, copy.sourceTitle, copy.question])].join(" ").toLowerCase().includes(t));
  });
}
const questionSubjectsForSearch = (q: PYQQuestion) => (q.subjectMemberships || [{ subject: q.subject, topic: q.topic }]).flatMap(m => [m.subject, m.topic]);
export function shuffled<T>(items: T[]): T[] {
  const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result;
}
