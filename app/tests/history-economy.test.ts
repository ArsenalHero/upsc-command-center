import { englishQuestion } from "../src/utils/englishQuestion";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { historyEconomyBank, originalBank, rawQuestionBank, questionBank, questionById, canonicalQuestionId } from "../src/data/questionBank";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { buildQuestionCollections } from "../src/utils/questionCollections";
import { cleanStudyText, completeOptionExplanation, englishStudyText, explanationStatus, optionReviews } from "../src/utils/explanationReview";
import { historyEconomySources, historyEconomyExamOccurrences, parseHistoryEconomySource } from "../scripts/import-history-economy.mjs";
import reviews from "../src/data/explanation-reviews.json";
import type { ExplanationReview, PYQQuestion } from "../src/utils/pyq";
import { validateData } from "../src/services/validation";

test("13 new History/Economy sources retain all 1,952 questions, explanations, choices and provenance", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/HISTORY-ECONOMY-SOURCES.json", import.meta.url), "utf8"));
  assert.equal(historyEconomyBank.length, 1952);
  assert.equal(new Set(rawQuestionBank.map(q => q.id)).size, 7882);
  assert.deepEqual(["History", "Economy"].map(s => historyEconomyBank.filter(q => q.subject === s).length), [1497,455]);
  assert.equal(historyEconomyBank.filter(q => !q.answer).length, 3);
  for (const source of historyEconomySources) {
    const qs = historyEconomyBank.filter(q => q.sourceFile === source.file), m = manifest.find((m: {file:string}) => m.file === source.file);
    assert.equal(qs.length, source.count); assert.equal(qs[0].number, source.first); assert.equal(qs.at(-1)!.number, source.last);
    for (const q of qs) {
      assert.equal(q.sourceSha256, m.sha256); assert.match(q.sourceSha256!, /^[a-f0-9]{64}$/);
      assert.ok(q.explanation?.justification); assert.equal(q.verification,"required");
      assert.ok([4,5].includes(Object.keys(q.options).length));
      assert.ok(Object.values(q.options).every(value => value.trim() && !value.includes("✅")));
      assert.equal(q.keyStatus, q.answer ? "provided" : "pending"); assert.equal(q.marks,1); assert.equal(q.negativeMarks,0);
      assert.equal(q.sourceUrl, ""); assert.equal(q.keyUrl, "");
      if(q.answer) assert.ok(q.options[q.answer]);
    }
  }
  for(const [file,number] of [["AM1.txt",203],["MH4.txt",261],["MH6.txt",247],["ECO2.txt",67]] as const) assert.equal(Object.keys(historyEconomyBank.find(q => q.sourceFile === file && q.number === number)!.options).length,5);
});

test("local attachments reproduce the raw bank without dropping supplied explanations", { skip: !existsSync(resolve(process.cwd(),"../../upload/AM1.txt")) }, () => {
  for(const source of historyEconomySources) {
    const text=readFileSync(resolve(process.cwd(),"../../upload",source.file),"utf8");
    assert.deepEqual(parseHistoryEconomySource(text,source.file),historyEconomyBank.filter(q=>q.sourceFile===source.file));
  }
});

test("exam labels preserve multiple years, State PSC identity and unlabelled questions", () => {
  assert.deepEqual(historyEconomyExamOccurrences("UPPCS (Pre) 2021, 2020").map(e => e.year),[2021,2020]);
  assert.equal(historyEconomyExamOccurrences("UPBEO 2020")[0].name,"UPPSC BEO");
  assert.equal(historyEconomyExamOccurrences("Uttaranchal (Pre) 2004")[0].state,"Uttarakhand");
  assert.equal(historyEconomyExamOccurrences("CDS 2021 (I)")[0].group,"CDS & CAPF");
  const q=historyEconomyBank.find(q=>q.id==="history-modern-part-1-q-055")!;
  assert.equal(q.year,0); assert.deepEqual(q.examOccurrences,[]);
});

test("duplicate imports keep old IDs, official keys and every original source version", () => {
  assert.equal(questionBank.length,7535);
  assert.equal(historyEconomyBank.filter(q=>canonicalQuestionId(q.id)!==q.id).length,92);
  const duplicate=historyEconomyBank.find(q=>q.id==="economy-part-3-q-002")!, official=questionById.get(canonicalQuestionId(duplicate.id))!;
  assert.equal(duplicate.answer,"d"); assert.equal(official.answer,"a"); assert.equal(official.keyStatus,"official");
  assert.equal(questionById.get(duplicate.id)!.answer,"a");
  assert.ok(official.sourceVariants!.some(q=>q.id===duplicate.id && q.answer==="d" && q.explanation?.justification===englishQuestion(duplicate).explanation?.justification));
  for(const q of originalBank) assert.deepEqual([questionById.get(q.id)!.question,questionById.get(q.id)!.options,questionById.get(q.id)!.answer],[q.question,q.options,q.answer]);
});

test("editorial review requires every choice, identifiable references and explicit review status", () => {
  for(const [id,review] of Object.entries(reviews)) {
    const q=questionById.get(id)!; assert.ok(q); assert.ok(completeOptionExplanation(q));
    assert.deepEqual(Object.keys(review.explanation.options).sort(),Object.keys(q.options).sort());
    if(review.status==="referenced") assert.ok(review.explanation.references.length);
    assert.ok(review.explanation.references.every(r=>r.url.startsWith("https://") && !/\[cite|example\./.test(r.url)));
    assert.ok(!/\[cite:|I will output|Wait,/.test(review.explanation.justification));
  }
  assert.equal(explanationStatus(questionById.get("history-modern-part-6-q-029")!),"referenced");
  assert.equal(explanationStatus(questionById.get("history-modern-part-4-q-164")!),"disputed");
  assert.equal(explanationStatus(questionById.get("history-modern-part-3-q-002")!),"source");
});

test("unresolved answers save time and choices without scoring; earlier answer snapshots remain unchanged", () => {
  const data=createEmptyData(), id="history-modern-part-4-q-164", raw=historyEconomyBank.find(q=>q.id===id)!, q=questionById.get(id)!;
  assert.equal(raw.answer,"d"); assert.equal(q.answer,null);
  const session=startSession([q],"practice",emptyFilters()), response={...emptyResponse(),option:"d",seconds:42,submitted:true,key:keySnapshot(q)};
  session.responses[id]=response;
  const attempt=responseAttempt(q,session,response,data.subjects);
  assert.equal(attempt.attempt!.outcome,"ungraded"); assert.equal(attempt.attempt!.seconds,42); assert.equal(sessionReport(session,questionById).incorrect,0);
  const historical={...response,key:keySnapshot(raw)};
  assert.equal(responseAttempt(q,session,historical,data.subjects).attempt!.outcome,"correct");
  session.responses[id]=historical; assert.equal(sessionReport(session,questionById).correct,1);
  data.pyqs=[attempt];data.prelims={...emptyPrelims(),session};assert.equal(validateData(JSON.parse(JSON.stringify(data))).pyqs[0].attempt!.seconds,42);
  const chronology=questionById.get("history-modern-part-6-q-029")!;
  assert.equal(chronology.answer,"c"); assert.equal(chronology.suppliedAnswer,null);
});

test("reviewed duplicate choices remap by text and never overwrite official grading", () => {
  const base=originalBank[0], a={...base,id:"base"}, b={...base,id:"alias",keyStatus:"provided" as const,options:{a:base.options.b,b:base.options.a,c:base.options.c,d:base.options.d},answer:"b"};
  const review=reviews[base.id] as ExplanationReview;
  const c=buildQuestionCollections([a,b],[{canonicalId:"base",duplicateIds:["alias"],keyConflict:true}],{base:{...review,answer:"c"}});
  assert.equal(c.byId.get("base")!.answer,base.answer);
  assert.equal(c.byId.get("alias")!.answer,"a");
  assert.equal(c.byId.get("alias")!.explanationReview!.explanation.options!.a,review.explanation.options!.b);
  assert.equal(c.questions[0].sourceVariants![0].answer,"b");
  const inherited=buildQuestionCollections([a,b],[{canonicalId:"base",duplicateIds:["alias"]}],{alias:{...review,explanation:{...review.explanation,options:{a:review.explanation.options!.b,b:review.explanation.options!.a,c:review.explanation.options!.c,d:review.explanation.options!.d}}}});
  assert.equal(inherited.questions[0].explanationReview!.explanation.options!.b,review.explanation.options!.b);
  assert.equal(inherited.questions[0].answer,base.answer);
});

test("option review covers all choices without inventing evidence or dropping bilingual table cells", () => {
  assert.match(englishStudyText("A. Kubha / कुभा | 1. Gandak / गंडक"),/Kubha.*Gandak/);
  assert.equal(cleanStudyText("A /n/n B[cite: 1]"),"A \n\n B");
  for(const q of questionBank) assert.deepEqual(optionReviews(q).map(note=>note.key),Object.keys(q.options));
  const q={...historyEconomyBank[0],question:"Consider:\n1. A fact\n2. Another fact\nWhich statements are correct?",options:{a:"1 only",b:"2 only",c:"Both 1 and 2",d:"Neither 1 nor 2"},answer:"a"} as PYQQuestion;
  assert.match(optionReviews(q).find(note=>note.key==="b")!.reason,/includes 2.*omits 1/);
  assert.match(optionReviews(q).find(note=>note.key==="d")!.reason,/no statements.*omits 1/);
  const unknown={...q,question:"Which person?",options:{a:"Unknown A",b:"Unknown B",c:"Unknown C",d:"Unknown D"},explanation:undefined};
  assert.ok(optionReviews(unknown).every(note=>note.basis==="missing"));
});
