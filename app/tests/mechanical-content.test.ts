import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { canGradeMechanical, type MechanicalQuestion } from "../src/utils/mechanical";
const root=new URL("../public/",import.meta.url),catalog=JSON.parse(readFileSync(new URL("mechanical/catalog.json",root),"utf8"));
const subject=catalog.subjects.find((item: { id: string })=>item.id==="engineering-mechanics");
const bytes=readFileSync(new URL(subject.url,root)),bank=JSON.parse(bytes.toString()),questions:MechanicalQuestion[]=bank.questions;
const thermodynamics=catalog.subjects.find((item: { id: string })=>item.id==="thermodynamics");
const thermoBytes=readFileSync(new URL(thermodynamics.url,root));
const thermoBank=JSON.parse(thermoBytes.toString());
const thermoQuestions:MechanicalQuestion[]=thermoBank.questions;
const sourceHash="7e5ed55860f7f23dee3d581c0e5c6df9932d716613a54a619789a14417709fc0";
test("exact selected PDF scope contains all 807 questions and ten complete chapters",()=>{
  assert.equal(subject.count,807);assert.equal(questions.length,807);assert.equal(new Set(questions.map(q=>q.id)).size,807);
  assert.deepEqual(questions.map(q=>q.number),Array.from({length:807},(_,i)=>i+1));assert.equal(subject.topics.length,10);assert.equal(subject.topics.reduce((s:any,t:any)=>s+t.count,0),807);
  assert.equal(bank.source.sha256,sourceHash);assert.equal(bank.source.firstPrintedPage,15);assert.equal(bank.source.lastPrintedPage,156);
  for(const q of questions){assert.equal(q.source.sha256,sourceHash);assert.ok(q.source.page>=1&&q.source.page<=142);assert.equal(q.source.printedPage,q.source.page+14);assert.ok(q.topic&&q.subtopic&&q.question.trim()&&q.explanation.trim());}
  assert.match(subject.url,new RegExp(createHash("sha256").update(bytes).digest("hex").slice(0,12)));
});
test("complete reviewed text, corrections and ambiguous answers have usable provenance",()=>{
  for(const q of questions){
    assert.ok(!q.transcriptionIssues?.length,`Q${q.number} unresolved transcription`);assert.ok(!q.parseIssues?.length,`Q${q.number} unresolved parse`);
    const opts=Object.keys(q.options);if(q.optionsUnavailable){assert.equal(q.number,348);assert.equal(opts.length,0);}else{assert.ok(opts.length>=4&&opts.length<=5,`Q${q.number} choices`);assert.ok(Object.values(q.options).every(v=>v.trim()));}
    assert.ok(q.review.note&&q.review.references.length,`Q${q.number} review provenance`);q.review.references.forEach(r=>assert.match(r.url,/^https:\/\//));
    if(q.review.status==="disputed"){assert.equal(q.answer,null);assert.equal(canGradeMechanical(q),false);}else{assert.ok(canGradeMechanical(q),`Q${q.number} should grade`);}
    if(q.review.status==="corrected")assert.ok(q.sourceExplanation?.trim(),`Q${q.number} full printed original absent`);
  }
  assert.equal(questions.find(q=>q.number===544)!.answer,"b");assert.equal(questions.find(q=>q.number===618)!.answer,null);assert.equal(Object.keys(questions.find(q=>q.number===695)!.options).length,5);
  assert.equal(questions.find(q=>q.number===109)!.review.status,"disputed");assert.match(questions.find(q=>q.number===109)!.options.c,/215/);
});
test("only bounded diagram crops ship, and the audit reconciles every source item",()=>{
  const used=new Set<string>();for(const q of [...questions,...thermoQuestions])for(const f of q.figures||[]){assert.ok(f.url&&f.alt);const path=f.url!;assert.match(path,/^mechanical\/figures\/.+-[a-f0-9]{10}\.svg$/);used.add(path.split("/").at(-1)!);const svg=readFileSync(new URL(path,root),"utf8");assert.match(svg,/data:image\/webp;base64,/);assert.ok(!svg.includes("<script"));const [x0,y0,x1,y1]=f.bbox!;assert.ok(x1>x0&&y1>y0);assert.ok((x1-x0)*(y1-y0)<596*843*.4);}
  assert.ok(used.size>350);assert.deepEqual(readdirSync(new URL("mechanical/figures/",root)).sort(),[...used].sort());
  const audit=JSON.parse(readFileSync(new URL(subject.auditDataUrl,root),"utf8"));assert.equal(audit.questions,807);assert.equal(audit.independentlyExamined,807);assert.equal(audit.fullyTranscribed,807);assert.deepEqual(audit.missingIndependentReview,[]);assert.deepEqual(audit.transcriptionNeedsReview,[]);assert.deepEqual(audit.conflictingReviewNotes,[]);
  assert.deepEqual(audit.shortenedExplanationChecks,[]);
  assert.equal(audit.diagrams,questions.reduce((s,q)=>s+(q.figures?.length||0),0));assert.equal(subject.reviewed+subject.corrected+subject.disputed,807);
});

test("Thermodynamics reconciles all 940 uploaded questions without changing Engineering Mechanics", () => {
  assert.equal(catalog.subjects.length, 2);
  assert.equal(catalog.total, 1747);
  assert.equal(catalog.reviewed + catalog.corrected + catalog.disputed, 1747);
  assert.equal(thermodynamics.count, 940);
  assert.equal(thermodynamics.topics.length, 7);
  assert.equal(thermodynamics.topics.reduce((total: number, topic: { count: number }) => total + topic.count, 0), 940);
  assert.deepEqual(thermoQuestions.map(q => q.number), Array.from({ length: 940 }, (_, index) => index + 1));
  assert.equal(new Set([...questions, ...thermoQuestions].map(q => q.id)).size, 1747);
  const hash = "b7734b9ee9efc82e6b2fa960e8ebf0400f892fa6f19ecbed8bbe8a5ad8093c21";
  assert.equal(thermoBank.source.sha256, hash);
  assert.equal(thermoBank.source.firstPrintedPage, 15);
  assert.equal(thermoBank.source.lastPrintedPage, 165);
  assert.equal(thermoBank.source.importedFrom.sha256, "184a26c92eb62efdcf6da1f8f049eab68e350d67b4a7e18d28236feb5016a11a");
  assert.equal(thermoQuestions.at(-1)?.source.printedPage, 165);
  assert.equal(thermoQuestions.at(-1)?.source.pageEnd, 151);
  assert.match(thermodynamics.url, new RegExp(createHash("sha256").update(thermoBytes).digest("hex").slice(0, 12)));
  assert.equal(catalog.version, createHash("sha256").update(JSON.stringify(catalog.subjects)).digest("hex").slice(0, 12));

  for (const q of thermoQuestions) {
    assert.equal(q.subjectId, "thermodynamics");
    assert.equal(q.source.sha256, hash);
    assert.equal(q.source.printedPage, q.source.page + 14);
    assert.ok(q.source.page >= 1 && q.source.page <= (q.source.pageEnd ?? 0) && (q.source.pageEnd ?? 0) <= 151);
    assert.ok(q.question.trim() && q.explanation.trim() && q.topic && q.subtopic);
    if(q.optionsUnavailable) {
      assert.equal(Object.keys(q.options).length, 0);
      assert.equal(q.review.status, "disputed");
    } else {
      assert.ok(Object.keys(q.options).length >= 2 && Object.keys(q.options).length <= 6, `Q${q.number} choices`);
    }
    assert.ok(Object.values(q.options).every(option => option.trim()));
    assert.ok(q.review.note && q.review.references.length > 0);
    assert.equal(canGradeMechanical(q), q.review.status !== "disputed");
    if (q.review.status !== "verified") assert.ok(q.sourceExplanation?.trim());
    if (q.review.status === "disputed") assert.equal(q.answer, null);
  }
  const absentChoices = thermoQuestions.find(q => q.number === 122)!;
  assert.equal(absentChoices.optionsUnavailable, true);
  assert.equal(absentChoices.sourceAnswer, "d");
  assert.equal(absentChoices.answer, null);
  assert.equal(thermoQuestions.find(q => q.number === 62)!.answer, "a");
  const audit = JSON.parse(readFileSync(new URL(thermodynamics.auditDataUrl, root), "utf8"));
  assert.equal(audit.fullyTranscribed, 940);
  assert.equal(audit.independentlyExamined, 940);
  assert.deepEqual(audit.uploadReconciliation.questionNumbers, thermoQuestions.map(q=>q.number));
  assert.equal(audit.uploadReconciliation.fullQuestionPhotosPublished, 0);
  assert.equal(audit.uploadReconciliation.fullExplanationPhotosPublished, 0);
  assert.equal(audit.diagrams, thermoQuestions.reduce((count, q) => count + (q.figures?.length ?? 0), 0));
});
