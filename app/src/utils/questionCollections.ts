import type { PYQQuestion } from "./pyq";
import type { PYQRecord } from "../types";
import { examOccurrences } from "./exams";
import { latestAttempts } from "./pyq";

export interface DuplicateGroup { canonicalId: string; duplicateIds: string[]; keyConflict?: boolean }
export const questionSubjects = (q: PYQQuestion) => [...new Set((q.subjectMemberships || [{ subject: q.subject, topic: q.topic }]).map(m => m.subject))];
export const matchesSubject = (q: PYQQuestion, subject: string) => !subject || questionSubjects(q).includes(subject);
export const questionTopics = (q: PYQQuestion, subject = "") => [...new Set((q.subjectMemberships || [{ subject: q.subject, topic: q.topic }]).filter(m => !subject || m.subject === subject).map(m => m.topic))];

export function buildQuestionCollections(raw: PYQQuestion[], groups: DuplicateGroup[]) {
  const rawById = new Map(raw.map(q => [q.id, q])), aliases = new Map(raw.map(q => [q.id, q.id]));
  const groupById = new Map(groups.map(group => [group.canonicalId, group]));
  for (const group of groups) {
    if (!rawById.has(group.canonicalId)) throw new Error("Missing canonical question.");
    for (const id of group.duplicateIds) { if (!rawById.has(id)) throw new Error("Missing duplicate question."); aliases.set(id, group.canonicalId); }
  }
  const questions = raw.filter(q => aliases.get(q.id) === q.id).map(q => {
    const group = groupById.get(q.id);
    if (!group) return q;
    const copies = [q, ...group.duplicateIds.map(id => rawById.get(id)!)];
    const membership = new Map(copies.flatMap(copy => [{ subject: copy.subject, topic: copy.topic }]).map(m => [JSON.stringify(m), m]));
    const knownExams = copies.flatMap(copy => copy.sourceFile ? copy.examOccurrences || [] : examOccurrences(copy).filter(e => e.group !== "Unlabelled"));
    const occurrences = [...new Map(knownExams.map(e => [JSON.stringify(e), e])).values()] as NonNullable<PYQQuestion["examOccurrences"]>;
    const pending = !!group.keyConflict && q.keyStatus !== "official";
    return { ...q, sourceVariants: pending ? copies : copies.slice(1), subjectMemberships: [...membership.values()],
      ...(occurrences.length ? { examOccurrences: occurrences } : {}),
      ...(group.keyConflict ? { keyConflict: true } : {}),
      ...(pending ? { answer: null, keyStatus: "pending" as const } : {}),
    };
  });
  // Old session IDs keep their original wording/options; scored responses retain their key snapshots.
  const byId = new Map(raw.map(q => [q.id, q]));
  for (const q of questions) byId.set(q.id, q);
  const canonicalId = (id: string) => aliases.get(id) || id;
  const canonicalRecords = (records: PYQRecord[]) => records.map(record => record.attempt ? { ...record, attempt: { ...record.attempt, questionId: canonicalId(record.attempt.questionId) } } : record);
  const latest = (records: PYQRecord[]) => latestAttempts(canonicalRecords(records));
  return { questions, byId, canonicalId, canonicalRecords, latest };
}
