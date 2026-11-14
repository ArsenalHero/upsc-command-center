import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFilters, emptyPrelims, emptyResponse, filterQuestions, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { latestAttempts, type PYQQuestion } from "../src/utils/pyq";
import { createEmptyData } from "../src/data/defaults";
import { validateData, validatePrelims } from "../src/services/validation";
const bank: PYQQuestion[] = JSON.parse(readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"));
const byId = new Map(bank.map(q => [q.id, q]));
test("one right plus three wrong cancels out without per-question penalty rounding for either paper", () => {
  for (const stage of ["Prelims", "CSAT"]) {
    const qs = bank.filter(q => q.stage === stage).slice(0, 5), s = startSession(qs, "test", emptyFilters());
    for (let i=0;i<4;i++) s.responses[qs[i].id] = { ...emptyResponse(), option: i===0 ? qs[i].answer! : qs[i].answer === "a" ? "b" : "a", seconds: 20, key: keySnapshot(qs[i]) };
    s.responses[qs[4].id] = { ...emptyResponse(), seconds: 10 };
    const r = sessionReport(s, byId);
    assert.ok(Math.abs(r.score)<1e-10); assert.equal(r.correct,1); assert.equal(r.incorrect,3); assert.equal(r.unattempted,1); assert.equal(r.seconds,90); assert.equal(r.accuracy,25);
    assert.equal(Object.values(r.groups.topic).reduce((sum,g)=>sum+g.seconds,0),90);
  }
});
test("stored key snapshots preserve historical marking and response attempt metadata", () => {
  const q = bank[0], s = startSession([q], "practice", emptyFilters());
  const r = { ...emptyResponse(), option:q.answer!, seconds:31.2, submitted:true, key:keySnapshot(q), review:true, confidence:2, notes:"Review this" };
  s.responses[q.id]=r;
  const changed={...q,answer:q.answer === "a" ? "b" : "a"};
  assert.equal(sessionReport(s,new Map([[q.id,changed]])).correct,1);
  const a=responseAttempt(changed,s,r,createEmptyData().subjects);
  assert.equal(a.attempt!.answerOption,q.answer); assert.equal(a.attempt!.seconds,31.2); assert.equal(a.attempt!.sessionMode,"practice"); assert.equal(a.revisionNeeded,true);
});
test("combined filters search table cells and distinguish latest mistakes from historical mistakes", () => {
  const q=bank[0], s=startSession([q],"practice",emptyFilters());
  const a=responseAttempt(q,s,{...emptyResponse(),option:"a"},createEmptyData().subjects,new Date("2026-10-01T00:00Z"));
  const b=responseAttempt(q,{...s,id:"second"},{...emptyResponse(),option:q.answer!},createEmptyData().subjects,new Date("2026-10-02T00:00Z"));
  const latest=latestAttempts([a,b]);
  assert.ok(!filterQuestions(bank,{...emptyFilters(),status:"incorrect"},latest,[],[]).some(x=>x.id===q.id));
  assert.ok(filterQuestions(bank,{...emptyFilters(),status:"bookmarked"},latest,[q.id],[]).some(x=>x.id===q.id));
  assert.equal(filterQuestions(bank,{...emptyFilters(),query:"Nagaland",paper:"Prelims GS-I"},latest,[],[])[0].number,52);
  assert.equal(filterQuestions(bank,{...emptyFilters(),query:"Nagaland",paper:"CSAT Paper II"},latest,[],[]).length,0);
});
test("v1 backups retain older history and include resumable sessions and completed reports", () => {
  const d=createEmptyData(); validateData(d);
  const s=startSession(bank.slice(0,3),"test",emptyFilters(),true,new Date("2026-10-01T00:00Z"));
  assert.equal(s.deadline,"2026-10-01T02:00:00.000Z");
  d.prelims={...emptyPrelims(),session:s,bookmarks:[bank[0].id],reports:[{...structuredClone(s),id:"finished",endedAt:"2026-10-01T01:00:00Z"}]};
  const restored=validateData(JSON.parse(JSON.stringify(d)));
  assert.equal(restored.prelims!.session!.questionIds.length,3); assert.equal(restored.prelims!.reports!.length,1);
  assert.throws(()=>validatePrelims({...emptyPrelims(),session:{...s,responses:{unknown:emptyResponse()}}}),/Unknown/);
  assert.throws(()=>validatePrelims({...emptyPrelims(),session:{...s,responses:{[bank[0].id]:{...emptyResponse(),seconds:-1}}}}),/time/);
  assert.throws(()=>validatePrelims({...emptyPrelims(),reports:[s]}),/complete/);
});
