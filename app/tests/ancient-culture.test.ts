import { englishQuestion } from "../src/utils/englishQuestion";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ancientCultureSources, parseAncientCultureSource } from "../scripts/import-ancient-culture.mjs";
import { historyEconomyExamOccurrences } from "../scripts/import-history-economy.mjs";
import { ancientCultureBank, rawQuestionBank, questionBank, questionById, canonicalQuestionId } from "../src/data/questionBank";
import { emptyFilters, emptyResponse, keySnapshot, startSession, sessionReport } from "../src/utils/prelims";
import { completeOptionExplanation, explanationStatus } from "../src/utils/explanationReview";

test("all 12 new sources preserve 1,255 records, bilingual notes and all 47 five-choice questions", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/ANCIENT-CULTURE-SOURCES.json", import.meta.url), "utf8"));
  assert.equal(manifest.length,12); assert.equal(ancientCultureBank.length,1255);
  assert.equal(rawQuestionBank.length,7882); assert.equal(new Set(rawQuestionBank.map(q=>q.id)).size,7882);
  assert.equal(ancientCultureBank.filter(q=>Object.keys(q.options).length===5).length,47);
  assert.deepEqual(["History","Art & Culture"].map(subject=>ancientCultureBank.filter(q=>q.subject===subject).length),[567,688]);
  for(const source of ancientCultureSources){
    const qs=ancientCultureBank.filter(q=>q.sourceFile===source.file), entry=manifest.find((m:{file:string})=>m.file===source.file);
    assert.equal(qs.length,source.count); assert.equal(qs[0].number,source.first); assert.equal(qs.at(-1)!.number,source.last);
    for(const q of qs){
      assert.equal(q.sourceSha256,entry.sha256); assert.match(q.sourceSha256!,/^[a-f0-9]{64}$/);
      assert.ok(q.question.trim()); assert.ok(q.explanation?.justification); assert.equal(q.verification,"required");
      assert.ok([4,5].includes(Object.keys(q.options).length)); assert.ok(q.answer&&q.options[q.answer]);
      assert.equal(q.keyStatus,"provided"); assert.equal(q.sourceUrl,""); assert.equal(q.keyUrl,"");
      assert.ok(Object.values(q.options).every(v=>v.trim()&&!v.includes("✅")));
    }
  }
});

test("attached source text reproduces every new record without losing an explanation", { skip: !existsSync(resolve(process.cwd(),"../../upload/AM2.txt")) }, () => {
  for(const source of ancientCultureSources){
    const text=readFileSync(resolve(process.cwd(),"../../upload",source.file),"utf8");
    assert.deepEqual(parseAncientCultureSource(text,source.file),ancientCultureBank.filter(q=>q.sourceFile===source.file));
  }
});

test("source numbering gaps and five unindented choices are preserved explicitly", () => {
  const medieval=ancientCultureBank.filter(q=>q.sourceFile==="AM3.txt");
  assert.ok(!medieval.some(q=>q.number===30)); assert.ok(medieval.some(q=>q.number===31));
  const heritage=ancientCultureBank.filter(q=>q.sourceFile==="gemini-code-1784985536086.txt");
  assert.equal(heritage[17].number,118); assert.equal(heritage[18].number,19); assert.match(heritage[17].sourceNotes!,/18th entry/);
  for(const id of ["history-ancient-rulers-q-113","history-medieval-part-1-q-162","history-medieval-part-1-q-163","history-medieval-part-4-q-193"]){
    const q=ancientCultureBank.find(q=>q.id===id)!;
    assert.equal(Object.keys(q.options).length,5); assert.ok(!q.question.includes(q.options.a));
  }
});

test("re-exam commas and MPPSC spelling preserve the correct exam identity and year", () => {
  const repeated=historyEconomyExamOccurrences("UPPCS (Pre, Re-Exam) 2015");
  assert.equal(repeated.length,1); assert.equal(repeated[0].name,"UPPCS"); assert.equal(repeated[0].year,2015); assert.match(repeated[0].label,/Re-Exam/);
  const mp=historyEconomyExamOccurrences("M.P.P.S.C. (Pre) 1995")[0];
  assert.equal(mp.group,"State PSC"); assert.equal(mp.name,"MPPSC"); assert.equal(mp.year,1995);
});

test("90 repeats merge while every source variant and old question ID remain available", () => {
  assert.equal(questionBank.length,7536);
  assert.equal(ancientCultureBank.filter(q=>canonicalQuestionId(q.id)!==q.id).length,90);
  const duplicate=ancientCultureBank.find(q=>q.id==="culture-literature-performing-arts-q-133")!;
  assert.equal(canonicalQuestionId(duplicate.id),canonicalQuestionId("history-modern-part-6-q-221"));
  const primary=questionById.get(canonicalQuestionId(duplicate.id))!;
  assert.ok(primary.sourceVariants?.some(q=>q.id===duplicate.id&&q.explanation?.justification===englishQuestion(duplicate).explanation?.justification));
  assert.equal(questionById.get(duplicate.id)!.question,englishQuestion(duplicate).question);
});

test("UNESCO reviews explain every option and scope latest to the exam's choices", () => {
  for(const id of ["culture-heritage-part-1-q-001","culture-heritage-part-1-q-002"]){
    const q=questionById.get(id)!; assert.equal(q.explanationReview?.status,"referenced"); assert.equal(explanationStatus(q),"referenced"); assert.ok(completeOptionExplanation(q));
    assert.ok(q.explanationReview!.explanation.references.length);
    assert.equal(ancientCultureBank.find(q=>q.id===id)!.keyStatus,"provided");
  }
  assert.match(questionById.get("culture-heritage-part-1-q-002")!.explanationReview!.explanation.justification,/2024 question/);
});

test("disputed historical attributions save time without a wrong result and keep supplied answers", () => {
  for(const id of ["history-medieval-part-3-q-101","culture-literature-performing-arts-q-073"]){
    const q=questionById.get(id)!, raw=ancientCultureBank.find(q=>q.id===id)!;
    assert.equal(explanationStatus(q),"disputed"); assert.equal(q.answer,null); assert.equal(q.keyStatus,"pending");
    assert.equal(q.suppliedAnswer,raw.answer); assert.ok(raw.answer); assert.ok(completeOptionExplanation(q));
    const s=startSession([q],"practice",emptyFilters());
    s.responses[q.id]={...emptyResponse(),option:raw.answer,seconds:17,submitted:true,key:keySnapshot(q)};
    const report=sessionReport(s,questionById);
    assert.equal(report.attempted,1); assert.equal(report.correct,0); assert.equal(report.incorrect,0); assert.equal(report.ungraded,1); assert.equal(report.seconds,17);
  }
});
