import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { explanationGapBank, originalBank, questionBank, questionById, rawQuestionBank } from "../src/data/questionBank";
import { suppliedExplanations, suppliedExplanationsFor } from "../src/data/suppliedExplanations";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { validateData } from "../src/services/validation";
import { questionFingerprint } from "../scripts/deduplicate-pyqs.mjs";
import { reconcileQuestions, sourceQuestion, sourceQuestionBlocks } from "../scripts/import-explanation-questions.mjs";
import summary from "../docs/EXPLANATION-QUESTION-IMPORT.json";
import review from "../docs/EXPLANATION-QUESTION-REVIEW.json";
import reconciliation from "../docs/EXPLANATION-QUESTION-RECONCILIATION.json";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const baseline = rawQuestionBank.filter(q => !q.id.startsWith("supplied-pyq-"));

test("all explanation entries are accounted for and only 412 complete new PYQs extend the bank", () => {
  assert.equal(Object.keys(review.records).length,8039);
  assert.equal(Object.keys(reconciliation).length,8039);
  assert.deepEqual(summary.classifications,{represented:6223,"possible-repeat":1375,held:29,added:412});
  assert.equal(Object.values(summary.classifications).reduce((a,b)=>a+b,0),suppliedExplanations.length);
  assert.equal(explanationGapBank.length,412); assert.equal(questionBank.length,7947);
  assert.deepEqual(summary.subjects,{"Art & Culture":2,Environment:18,Geography:327,History:55,"Polity & Governance":10});
  for (const [name, expected] of Object.entries(review.baselineSha256)) {
    assert.equal(sha(readFileSync(new URL(`../src/data/${name}-bank.json`,import.meta.url))),expected,`${name} existing questions unchanged`);
  }
  assert.deepEqual(originalBank.map(q => questionById.get(q.id)!.answer),originalBank.map(q=>q.answer));
});

test("added questions have no full-stem/choice duplicate and preserve the matching English explanation and answer letters", () => {
  const seen = new Set(baseline.map(questionFingerprint));
  for (const raw of explanationGapBank) {
    const key=questionFingerprint(raw); assert.ok(!seen.has(key),raw.id); seen.add(key);
    const q=questionById.get(raw.id)!; const entries=suppliedExplanationsFor(q); assert.equal(entries.length,1,raw.id);
    assert.equal(q.answer,entries[0].answer.toLowerCase(),raw.id);
    assert.ok(q.answer && q.options[q.answer]); assert.ok(Object.values(q.options).every(v=>v.trim()));
    assert.ok(q.question.trim() && q.blocks?.length && q.explanation?.justification.trim());
    assert.equal(q.keyStatus,"provided"); assert.equal(q.verification,"required");
    assert.ok(!/[\u0900-\u097f]|\[Image:/i.test(JSON.stringify({question:q.question,options:q.options,blocks:q.blocks})),q.id);
    assert.ok(q.examOccurrences!.every(e=>e.year>=1900&&e.year<=2025&&e.group!=="Unspecified"&&e.name));
  }
});

test("re-running the reviewed reconciliation produces the same IDs/content and cannot inflate the bank", () => {
  const first=reconcileQuestions(suppliedExplanations,review.records,baseline,review.sourceSha256);
  assert.deepEqual(first.questions,explanationGapBank);
  const second=reconcileQuestions(suppliedExplanations,review.records,[...baseline,...explanationGapBank],review.sourceSha256);
  assert.equal(second.questions.length,0); assert.equal(Object.values(second.records).filter((r:any)=>r.status==="repeat").length,412);
});

test("book question numbering does not replace statement codes and matching lists remain complete", () => {
  const q=questionById.get("supplied-pyq-q-16")!;
  assert.deepEqual(q.blocks!.find(b=>b.type==="list")!.items!.map(v=>v.slice(0,2)),["1.","2.","3.","4."]);
  assert.notEqual(questionFingerprint({...q,options:{...q.options,a:"3, 1, 4, 2"}}),questionFingerprint(q));
  const table=questionById.get("supplied-pyq-q-2475")!.blocks!.find(b=>b.type==="table")!;
  assert.deepEqual(table.rows!.map(r=>r[1]),["1. 1929","2. 1928","3. 1932","4. 1907"]);
  assert.deepEqual(sourceQuestionBlocks('<ol start="79"><li><p>Consider these statements:</p></li><li><p>First statement.</p></li><li><p>Second statement.</p></li></ol>')[1].items,["1. First statement.","2. Second statement."]);
  const source=suppliedExplanations.find(e=>e.id==="q-1238")!;
  assert.throws(()=>sourceQuestion({...source,year:""},review.sourceSha256),/attribution/);
  assert.throws(()=>sourceQuestion({...source,answer:"E"},review.sourceSha256),/answer choice/);
  assert.throws(()=>sourceQuestion({...source,questionText:"[Image: map]"},review.sourceSha256),/diagram/);
});

test("new State PSC questions save right/wrong, active time, notes and exam/year through backup/resume", () => {
  const q=questionById.get("supplied-pyq-q-1238")!, data=createEmptyData();
  const session=startSession([q],"practice",{...emptyFilters(),examGroup:"State PSC",state:"Madhya Pradesh",year:"1991"});
  const correct={...emptyResponse(),option:q.answer!,seconds:23,submitted:true,key:keySnapshot(q),notes:"Revise Buddhist literature",confidence:4};
  session.responses[q.id]=correct; data.prelims={...emptyPrelims(),session};
  data.pyqs=[responseAttempt(q,session,correct,data.subjects)];
  const restored=validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.pyqs[0].attempt!.outcome,"correct");assert.equal(restored.pyqs[0].attempt!.seconds,23);
  assert.equal(restored.pyqs[0].attempt!.examName,"MPPSC");assert.equal(restored.pyqs[0].year,1991);
  const wrong={...correct,option:Object.keys(q.options).find(k=>k!==q.answer)!,seconds:37};
  assert.equal(responseAttempt(q,session,wrong,data.subjects).attempt!.outcome,"incorrect");
  assert.equal(sessionReport(session,new Map([[q.id,q]])).correct,1);
});
