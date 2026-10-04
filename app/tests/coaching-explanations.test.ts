import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionBank, questionById, rawQuestionBank, originalBank } from "../src/data/questionBank";
import { reviewedLibraryQuestion } from "../src/data/reviewedLibrary";
import { suppliedExplanationsFor } from "../src/data/suppliedExplanations";
import { englishQuestion } from "../src/utils/englishQuestion";
import { englishStudyText, explanationStatus } from "../src/utils/explanationReview";
import { buildQuestionCollections } from "../src/utils/questionCollections";
import { emptyFilters, emptyResponse, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { createEmptyData } from "../src/data/defaults";
import { validateData } from "../src/services/validation";
import { attemptStats, type ExplanationReview } from "../src/utils/pyq";
import groups from "../src/data/duplicate-groups.json";
import oldReviews from "../src/data/explanation-reviews.json";
import newReviews from "../src/data/coaching-explanation-reviews.json";

const reviews = newReviews as Record<string, ExplanationReview>;
const rawById = new Map(rawQuestionBank.map(q => [q.id, q]));
const resolvedKeys: Record<string, string> = {
  "history-ancient-rulers-q-113": "c",
  "economy-part-2-q-067": "c",
  "history-medieval-part-5-q-201": "b",
  "polity-part-1-q-002": "c",
  "polity-part-1-q-015": "c",
  "polity-part-1-q-016": "a",
  "polity-part-1-q-042": "d",
  "geography-part-7-q-078": "a",
  "polity-part-2-q-041": "c",
  "polity-part-2-q-108": "b",
  "polity-part-2-q-195": "c",
  "polity-part-5-q-144": "b",
  "polity-part-6-q-100": "b",
  "geography-part-1-q-003": "b",
  "geography-part-2-q-003": "c",
  "geography-part-2-q-013": "a",
  "geography-part-2-q-019": "b",
  "economy-part-7-q-212": "d",
  "history-modern-part-3-q-009": "b",
  "polity-part-8-q-061": "a",
  "geography-part-6-q-147": "c",
  "history-modern-part-4-q-055": "c",
  "polity-part-6-q-147": "c",
  "science-part-2-q-447": "a",
  "science-part-4-q-032": "d",
  "history-modern-part-5-q-157": "d",
  "polity-part-2-q-140": "c",
  "polity-part-2-q-040": "d",
  "polity-part-2-q-123": "d",
  "polity-part-6-q-050": "a",
  "geography-part-6-q-161": "c",
  "culture-heritage-part-2-q-035": "d",
  "science-part-3-q-868": "c",
  "polity-part-5-q-118": "c",
  "polity-part-5-q-129": "c",
  "polity-part-1-q-079": "b",
  "economy-part-4-q-066": "b",
  "science-part-4-q-313": "c",
  "history-modern-part-3-q-018": "c",
  "polity-part-1-q-043": "b",
  "history-modern-part-2-q-162": "a",
  "polity-part-2-q-032": "a",
  "polity-part-5-q-111": "b",
  "science-part-2-q-395": "a",
  "economy-part-3-q-024": "d",
  "environment-pollution-q-050": "b",
  "history-modern-part-6-q-306": "d",
  "economy-part-1-q-036": "d",
  "economy-part-4-q-047": "d",
  "history-modern-part-1-q-013": "b",
  "history-modern-part-2-q-095": "d",
  "economy-part-4-q-007": "b",
  "history-modern-part-3-q-001": "d",
  "geography-part-7-q-009": "a",
  "polity-part-1-q-049": "d",
  "polity-part-1-q-051": "b",
  "polity-part-5-q-112": "a",
  "science-part-4-q-121": "b",
  "science-part-4-q-225": "c",
  "history-modern-part-5-q-151": "b"
};
const disputed = [
  "economy-part-1-q-120",
  "history-ancient-part-4-q-101",
  "history-modern-part-4-q-164",
  "history-modern-part-1-q-055",
  "economy-part-3-q-135",
  "history-medieval-part-3-q-101",
  "culture-literature-performing-arts-q-073",
  "geography-part-1-q-098"
];
const gsId = (n: number) => `upsc-2025-prelims-gs1-a-${String(n).padStart(3,"0")}`;

test("all 19 missing GS explanations and all 80 CSAT explanations have reviewed English reasoning and identifiable references", () => {
  for (const n of [11,21,22,23,28,52,57,62,66,68,78,79,80,89,92,97,98,99,100]) {
    const q = questionById.get(gsId(n))!;
    assert.equal(explanationStatus(q),"referenced",q.id);
    assert.ok(q.explanationReview!.explanation.justification.trim(),q.id);
    assert.ok(q.explanationReview!.explanation.references.length,q.id);
  }
  for (const q of originalBank.filter(q => q.stage === "CSAT")) {
    assert.equal(explanationStatus(questionById.get(q.id)!),"referenced",q.id);
    assert.ok(reviews[q.id].explanation.justification.trim(),q.id);
  }
  assert.equal(Object.keys(reviews).length,187);
  for (const [id,r] of Object.entries(reviews)) {
    assert.ok(rawById.has(id),id);
    assert.equal(r.reviewedOn,"2026-10-04");
    assert.equal(r.preferReviewedExplanation,true);
    assert.ok(!/[\u0900-\u097f]/.test(JSON.stringify(r.explanation)),id);
    assert.doesNotMatch(r.explanation.justification,/\[cite:|supplied HTML|\.txt\b|explanation from supplied/i);
    if (r.status === "referenced") assert.ok(r.explanation.references.length,id);
    assert.ok(r.explanation.references.every(x => x.title.trim() && /^https:\/\//.test(x.url)),id);
  }
  const audit=JSON.parse(readFileSync(new URL("../docs/COACHING-EXPLANATIONS-REVIEW.json",import.meta.url),"utf8"));
  assert.deepEqual(audit.counts,{reviewed:187,referenced:179,disputed:8,missingGSFilled:19,csatReviewed:80});
  assert.deepEqual(audit.questions.map((x:{id:string})=>x.id).sort(),Object.keys(reviews).sort());
});

test("official keys, choices and marking remain intact; changes to provided keys are confined to the reviewed questions and their aliases", () => {
  assert.equal(originalBank.length,180);
  for (const raw of originalBank) {
    const q=questionById.get(raw.id)!;
    assert.deepEqual([q.answer,q.keyStatus,q.marks,q.negativeMarks,q.options],[raw.answer,raw.keyStatus,raw.marks,raw.negativeMarks,raw.options],raw.id);
  }
  const before=buildQuestionCollections(rawQuestionBank,groups,oldReviews as Record<string,ExplanationReview>);
  const allowed=new Set(Object.keys(reviews));
  for (const g of groups) if ([g.canonicalId,...g.duplicateIds].some(id=>allowed.has(id))) {
    allowed.add(g.canonicalId);g.duplicateIds.forEach(id=>allowed.add(id));
  }
  for (const [id,old] of before.byId) {
    const q=questionById.get(id)!;
    assert.deepEqual([q.id,q.marks,q.negativeMarks,Object.keys(q.options)],[old.id,old.marks,old.negativeMarks,Object.keys(old.options)],id);
    if (old.answer!==q.answer || old.keyStatus!==q.keyStatus) assert.ok(allowed.has(id),`Unreviewed key changed: ${id}`);
  }
  for (const [id,key] of Object.entries(resolvedKeys)) {
    const q=questionById.get(id)!;
    assert.equal(q.answer,key,id);assert.equal(q.keyStatus,"provided",id);
    assert.equal(explanationStatus(q),"referenced",id);
    const s=startSession([q],"practice",emptyFilters());
    const r={...emptyResponse(),option:key,seconds:23,submitted:true,key:keySnapshot(q)};
    s.responses[id]=r;
    assert.equal(responseAttempt(q,s,r,[]).attempt!.outcome,"correct",id);
    assert.equal(sessionReport(s,questionById).correct,1,id);
  }
  for(const [id,old,current] of [
    ["history-ancient-rulers-q-113","a","c"],["history-medieval-part-5-q-201","c","b"],
    ["polity-part-1-q-015","d","c"],["polity-part-1-q-016","d","a"]
  ]) {
    assert.equal(rawById.get(id)!.answer,old,id);
    assert.equal(questionById.get(id)!.answer,current,id);
    assert.equal(questionById.get(id)!.suppliedAnswer,old,id);
  }
});

test("disputed questions retain choices and time without assigning a right or wrong score", () => {
  for (const id of disputed) {
    const q=questionById.get(id)!,raw=rawById.get(id)!;
    assert.equal(q.answer,null,id);assert.equal(q.keyStatus,"pending",id);
    assert.equal(q.suppliedAnswer,raw.answer,id);assert.equal(explanationStatus(q),"disputed",id);
    const s=startSession([q],"practice",emptyFilters());
    const r={...emptyResponse(),option:raw.answer || Object.keys(q.options)[0],seconds:17,submitted:true,key:keySnapshot(q)};
    s.responses[id]=r;
    const saved=responseAttempt(q,s,r,[]);
    assert.equal(saved.attempt!.outcome,"ungraded",id);assert.equal(saved.attempt!.seconds,17);
    const report=sessionReport(s,questionById);
    assert.deepEqual([report.correct,report.incorrect,report.ungraded,report.seconds],[0,0,1,17],id);
  }
  assert.match(questionById.get("geography-part-1-q-098")!.explanationReview!.explanation.justification,/Only IV is correct/);
});

test("old answer snapshots keep their outcomes and time after a correction, including earlier pending responses", () => {
  const data=createEmptyData(),id="history-ancient-rulers-q-113",q=questionById.get(id)!,raw=rawById.get(id)!;
  const s=startSession([q],"practice",emptyFilters());
  const historical={...emptyResponse(),option:"a",seconds:21,submitted:true,key:keySnapshot(raw)};
  s.responses[id]=historical;
  const record=responseAttempt(q,s,historical,data.subjects);
  assert.equal(record.attempt!.outcome,"correct");assert.equal(record.attempt!.answerOption,"a");
  assert.equal(sessionReport(s,questionById).correct,1);
  data.pyqs=[record];data.prelims={filters:emptyFilters(),bookmarks:[],review:[],session:s};
  const restored=validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.pyqs[0].attempt!.outcome,"correct");
  assert.equal(restored.pyqs[0].attempt!.seconds,21);
  assert.equal(attemptStats(restored.pyqs).correct,1);
  const pendingId="economy-part-2-q-067",cad=questionById.get(pendingId)!;
  const oldSession=startSession([cad],"practice",emptyFilters());
  const pending={...emptyResponse(),option:"c",seconds:12,submitted:true,key:{...keySnapshot(cad),answer:null,status:"pending" as const}};
  oldSession.responses[pendingId]=pending;
  assert.equal(responseAttempt(cad,oldSession,pending,data.subjects).attempt!.outcome,"ungraded");
  assert.equal(sessionReport(oldSession,questionById).ungraded,1);
});

test("both English matching columns survive removal of Hindi translations", () => {
  assert.equal(englishStudyText("Party / दल : Leader / नेता"),"Party : Leader");
  assert.match(englishStudyText("1. Cassini / कैसिनी : Saturn / शनि"),/Cassini.*Saturn/);
  const party=questionById.get("polity-part-1-q-051")!.question;
  for (const word of ["Mukherjee","Rajagopalachari","Jagjivan Ram","Narendra Dev"]) assert.ok(party.includes(word),word);
  const spacecraft=questionById.get("science-part-4-q-121")!.question;
  for (const word of ["Venus","Mercury","outer solar system"]) assert.ok(spacecraft.includes(word),word);
  const editors=questionById.get("history-modern-part-5-q-151")!.question;
  for (const word of ["Mahatma Gandhi","Nauroji","Surendranath Banerjee","Taraknath Das"]) assert.ok(editors.includes(word),word);
  for(const id of ["polity-part-1-q-051","science-part-4-q-121","history-modern-part-5-q-151"]) {
    assert.ok(!/[\u0900-\u097f]/.test(questionById.get(id)!.question));
    assert.deepEqual(questionById.get(id)!.options,englishQuestion(rawById.get(id)!).options);
  }
});

test("the reading library applies the same reviewed correction and retains unmodified explanations elsewhere", () => {
  const q=questionById.get("history-ancient-rulers-q-113")!,entries=suppliedExplanationsFor(q);
  assert.ok(entries.length);
  for(const e of entries) {
    const reviewed=reviewedLibraryQuestion(e.id)!;
    assert.equal(reviewed.answer,"c");
    assert.match(reviewed.explanationReview!.explanation.justification,/Gautamiputra Satakarni/);
  }
  assert.equal(reviewedLibraryQuestion("q-1394"),undefined);
  const first=suppliedExplanationsFor(questionById.get(gsId(1))!)[0];
  assert.equal(reviewedLibraryQuestion(first.id),undefined);
  assert.equal(questionBank.length,7536);
});
