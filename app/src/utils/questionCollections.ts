import type { ExplanationReview, PYQQuestion } from "./pyq";
import type { PYQRecord } from "../types";
import { examOccurrences } from "./exams";
import { latestAttempts } from "./pyq";
import { englishStudyText } from "./explanationReview";

export interface DuplicateGroup { canonicalId: string; duplicateIds: string[]; keyConflict?: boolean }
export const questionSubjects = (q: PYQQuestion) => [...new Set((q.subjectMemberships || [{ subject: q.subject, topic: q.topic }]).map(m => m.subject))];
export const matchesSubject = (q: PYQQuestion, subject: string) => !subject || questionSubjects(q).includes(subject);
export const questionTopics = (q: PYQQuestion, subject = "") => [...new Set((q.subjectMemberships || [{ subject: q.subject, topic: q.topic }]).filter(m => !subject || m.subject === subject).map(m => m.topic))];

export function buildQuestionCollections(raw: PYQQuestion[], groups: DuplicateGroup[], reviews: Record<string, ExplanationReview> = {}) {
  reviews = { ...reviews };
  const originals = new Map(raw.map(q => [q.id, q]));
  const optionIdentity = (text: string) => englishStudyText(text).normalize("NFKC").toLowerCase().replace(/[\s.,:;’'“”]+/g, " ").trim();
  for (const group of groups) {
    if (reviews[group.canonicalId]) continue;
    const primary = originals.get(group.canonicalId);
    if (!primary) continue;
    for (const id of group.duplicateIds) {
      const copy = originals.get(id), review = reviews[id];
      if (!copy || !review) continue;
      const mapping = Object.fromEntries(Object.entries(primary.options).map(([key, value]) => [key, Object.keys(copy.options).find(k => optionIdentity(copy.options[k]) === optionIdentity(value))]));
      if (Object.keys(copy.options).length !== Object.keys(primary.options).length || Object.values(mapping).some(key => !key) || new Set(Object.values(mapping)).size !== Object.keys(copy.options).length) continue;
      const sourceAnswer = Object.hasOwn(review, "answer") ? review.answer : copy.answer;
      reviews[primary.id] = { ...review, ...(Object.hasOwn(review, "answer") ? { answer: sourceAnswer ? Object.keys(mapping).find(k => mapping[k] === sourceAnswer) || null : null } : {}), explanation: { ...review.explanation, options: Object.fromEntries(Object.entries(mapping).map(([key, copyKey]) => [key, review.explanation.options?.[copyKey!] || ""])) } };
      break;
    }
  }
  for (const group of groups) {
    const primary = originals.get(group.canonicalId)!, review = reviews[primary.id];
    if (!review) continue;
    for (const id of group.duplicateIds) {
      if (reviews[id]) continue;
      const copy = originals.get(id)!, mapping = Object.fromEntries(Object.entries(copy.options).map(([key, value]) => [key, Object.keys(primary.options).find(k => optionIdentity(primary.options[k]) === optionIdentity(value))]));
      if (Object.keys(copy.options).length !== Object.keys(primary.options).length || Object.values(mapping).some(key => !key) || new Set(Object.values(mapping)).size !== Object.keys(primary.options).length) continue;
      const primaryAnswer = primary.keyStatus === "official" ? primary.answer : Object.hasOwn(review, "answer") ? review.answer : primary.answer;
      const answer = primaryAnswer ? Object.keys(mapping).find(k => mapping[k] === primaryAnswer) || null : null;
      reviews[id] = { ...review, answer, explanation: { ...review.explanation, options: Object.fromEntries(Object.entries(mapping).map(([key, originalKey]) => [key, review.explanation.options?.[originalKey!] || ""])) } };
    }
  }
  const reviewed = raw.map(q => {
    const review = reviews[q.id];
    if (!review) return q;
    const adjusted = q.keyStatus !== "official" && Object.hasOwn(review, "answer");
    return { ...q, suppliedAnswer: q.answer, explanationReview: review, ...(adjusted ? { answer: review.answer ?? null, keyStatus: review.answer ? "provided" as const : "pending" as const } : {}) };
  });
  const rawById = new Map(raw.map(q => [q.id, q])), reviewedById = new Map(reviewed.map(q => [q.id, q])), aliases = new Map(raw.map(q => [q.id, q.id]));
  const groupById = new Map(groups.map(group => [group.canonicalId, group]));
  for (const group of groups) {
    if (!rawById.has(group.canonicalId)) throw new Error("Missing canonical question.");
    for (const id of group.duplicateIds) { if (!rawById.has(id)) throw new Error("Missing duplicate question."); aliases.set(id, group.canonicalId); }
  }
  const questions = reviewed.filter(q => aliases.get(q.id) === q.id).map(q => {
    const group = groupById.get(q.id);
    if (!group) return q;
    const copies = [q, ...group.duplicateIds.map(id => rawById.get(id)!)];
    const membership = new Map(copies.flatMap(copy => [{ subject: copy.subject, topic: copy.topic }]).map(m => [JSON.stringify(m), m]));
    const knownExams = copies.flatMap(copy => copy.sourceFile ? copy.examOccurrences || [] : examOccurrences(copy).filter(e => e.group !== "Unlabelled"));
    const occurrences = [...new Map(knownExams.map(e => [JSON.stringify(e), e])).values()] as NonNullable<PYQQuestion["examOccurrences"]>;
    const pending = !!group.keyConflict && q.keyStatus !== "official" && !Object.hasOwn(reviews[q.id] || {}, "answer");
    // Repeated uploads can supply notes absent from the original paper.
    // Raw versions and the original paper's official key remain intact.
    const explanationCopy = q.explanation || q.explanationReview ? undefined : copies.find(copy => copy.explanation?.justification && copy.answer && q.answer && optionIdentity(copy.options[copy.answer]) === optionIdentity(q.options[q.answer]));
    return { ...q, sourceVariants: pending ? copies : copies.slice(1), subjectMemberships: [...membership.values()],
      ...(explanationCopy ? { explanation: explanationCopy.explanation, explanationSourceId: explanationCopy.id } : {}),
      ...(occurrences.length ? { examOccurrences: occurrences } : {}),
      ...(group.keyConflict ? { keyConflict: true } : {}),
      ...(pending ? { answer: null, keyStatus: "pending" as const } : {}),
    };
  });
  // Old session IDs keep their original wording/options; scored responses retain their key snapshots.
  const byId = new Map(reviewedById);
  for (const q of questions) byId.set(q.id, q);
  const canonicalId = (id: string) => aliases.get(id) || id;
  const canonicalRecords = (records: PYQRecord[]) => records.map(record => record.attempt ? { ...record, attempt: { ...record.attempt, questionId: canonicalId(record.attempt.questionId) } } : record);
  const latest = (records: PYQRecord[]) => latestAttempts(canonicalRecords(records));
  return { questions, byId, canonicalId, canonicalRecords, latest };
}
