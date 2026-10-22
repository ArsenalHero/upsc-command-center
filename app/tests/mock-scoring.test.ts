import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { fixtureLicense,prepareMockDatabase,setMockUser } from "./mock-license-fixture";
import { fmtMock,groupMockQuestions,mockMarkingGroups,mockPenaltyLabel,type MockQuestion } from "../src/utils/mockLab";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OutcomeFlow,ScoreWaterfall } from "../src/components/mock/MockScoreSummary";

test("scoring display rounds once and distinguishes one-third penalties from flat deductions",()=>{
 assert.equal(fmtMock(-13.999999999999998),"-14");assert.equal(fmtMock(-0.00000001),"0");assert.equal(fmtMock(NaN),"—");
 assert.match(mockPenaltyLabel(2,2/3),/⅓ of 2/);assert.match(mockPenaltyLabel(2.5,2.5/3),/⅓ of 2.5/);
 assert.equal(mockPenaltyLabel(2,0.67),"0.67");assert.equal(mockPenaltyLabel(2,0),"0");
 const qs=[...Array.from({length:21},()=>({positive:2,negative:2/3,outcome:"Correct",net:2,subject:"Polity",topic:"Rights"})),...Array.from({length:21},()=>({positive:2,negative:2/3,outcome:"Incorrect",net:-2/3,subject:"Polity",topic:"Rights"})),...Array.from({length:8},()=>({positive:2,negative:2/3,outcome:"Unattempted",net:0,subject:"Polity",topic:"Rights"}))] as MockQuestion[];
 const g=mockMarkingGroups(qs)[0];assert.equal(g.correct,21);assert.equal(g.incorrect,21);assert.equal(g.unattempted,8);assert.equal(fmtMock(g.deductions),"14");
 assert.equal(fmtMock(groupMockQuestions(qs,"subject")[0].net),"28");
});

test("score and outcome graphics keep totals visible without hovering and handle zero and negative scores",()=>{
 for(const data of [{gross:42,negative:13.999999999999998,score:28},{gross:0,negative:2,score:-2},{gross:0,negative:0,score:0}]){
  const html=renderToStaticMarkup(createElement(ScoreWaterfall,data));
  assert.match(html,/Marks earned/);assert.match(html,/Marks deducted/);assert.match(html,/Net score/);
  assert.doesNotMatch(html,/13\.999999|NaN|Infinity|range :/);
  assert.ok(html.includes(`>${fmtMock(data.score)}<`));
 }
 const html=renderToStaticMarkup(createElement(OutcomeFlow,{correct:21,incorrect:21,unattempted:8}));
 assert.match(html,/42 of 50 questions attempted/);assert.match(html,/84% attempt rate/);assert.match(html,/>50%<\/strong>/);
 const blank=renderToStaticMarkup(createElement(OutcomeFlow,{correct:0,incorrect:0,unattempted:50}));
 assert.match(blank,/100% of paper/);assert.doesNotMatch(blank,/NaN|Infinity/);
});

test("server applies GS, CSAT, zero penalties and mixed question schemes without premature rounding",async()=>{
 const db=new PGlite(),admin="11111111-1111-4111-8111-111111111111",token="ab".repeat(32);
 const api=async(op:string,p:Record<string,unknown>={})=>(await db.query<{data:any}>("select public.mock_lab($1,$2::jsonb) data",[op,JSON.stringify(p)])).rows[0].data;
 try{
  await prepareMockDatabase(db,[{id:admin,admin:true}]);await setMockUser(db,admin);await api("verify-license",{licenseKey:fixtureLicense});await api("profile",{displayName:"Scoring manager"});
  const cases=[
   {name:"GS screenshot",paper:"GS-I",positive:2,negative:2/3,correct:21,wrong:21,blank:8,score:28},
   {name:"CSAT third",paper:"CSAT",positive:2.5,negative:2.5/3,correct:10,wrong:3,blank:27,score:22.5},
   {name:"All wrong",paper:"GS-I",positive:2,negative:2/3,correct:0,wrong:3,blank:0,score:-2},
   {name:"All blank",paper:"GS-I",positive:2,negative:2/3,correct:0,wrong:0,blank:3,score:0},
   {name:"No penalty",paper:"GS-I",positive:2,negative:0,correct:1,wrong:2,blank:0,score:2},
   {name:"Flat deduction",paper:"GS-I",positive:2,negative:0.67,correct:1,wrong:3,blank:0,score:-0.01},
  ];
  for(const [i,c] of cases.entries()){
   await setMockUser(db,admin);
   const count=c.correct+c.wrong+c.blank;
   const testId=(await api("admin-test",{code:`SCORE-${i}`,name:c.name,paper:c.paper,kind:"Sectional",year:2027,duration:30,status:"active",positive:c.positive,negative:c.negative,questions:Array.from({length:count},(_,n)=>({question:`Scoring question number ${n+1}: which choice is correct?`,options:{a:"One",b:"Two",c:"Three",d:"Four"},correct:"a",explanation:"The configured choice is correct for this scoring fixture.",subject:"Polity",topic:`Topic ${n+1}`}))})).id;
   await setMockUser(db,null);await api("verify-license",{licenseKey:fixtureLicense,guestToken:token});
   const a=await api("start",{testId,guestToken:token});
   const answers=Object.fromEntries(a.questions.map((q:any,n:number)=>[q.id,{option:n<c.correct?"a":n<c.correct+c.wrong?"b":"",visited:true}]));
   const ack=await api("save",{attemptId:a.id,guestToken:token,answers,index:count-1,sequence:1,compact:true});
   assert.deepEqual(Object.keys(ack).sort(),["id","sequence","serverNow","status","testId"]);
   assert.ok(JSON.stringify(ack).length<300);assert.ok(!JSON.stringify(ack).includes('"questions"'));
   const done=await api("submit",{attemptId:a.id,guestToken:token,answers,sequence:2});
   assert.equal(done.result.score,c.score,c.name);assert.equal(done.result.correct,c.correct);assert.equal(done.result.incorrect,c.wrong);assert.equal(done.result.unattempted,c.blank);
   assert.equal(done.result.accuracy,c.correct+c.wrong?100*c.correct/(c.correct+c.wrong):0);
   assert.equal(done.result.maximum,count*c.positive);
   assert.equal(fmtMock(done.result.negative),fmtMock(c.wrong*c.negative));
   assert.equal(fmtMock(done.result.gross-done.result.negative),fmtMock(c.score));
   assert.equal((await api("save",{attemptId:a.id,guestToken:token,answers:{},sequence:1,compact:true})).status,"submitted");
   assert.equal((await api("attempt",{attemptId:a.id,guestToken:token})).result.score,c.score,"A late old autosave cannot change a submitted score");
  }
  await setMockUser(db,admin);
  const testId=(await api("admin-test",{code:"MIXED",name:"Mixed marking schemes",paper:"GS-I",kind:"Sectional",year:2027,duration:30,status:"active",positive:2,negative:2/3,questions:[{positive:3,negative:1},{positive:2,negative:0.5},{positive:1,negative:0}].map((scheme,i)=>({...scheme,question:`Mixed scheme question ${i+1}: which answer is correct?`,options:{a:"One",b:"Two",c:"Three",d:"Four"},correct:"a",explanation:"This question uses its own configured marking scheme.",subject:"Polity",topic:`Mixed ${i+1}`}))})).id;
  const a=await api("start",{testId});const done=await api("submit",{attemptId:a.id,sequence:1,answers:Object.fromEntries(a.questions.map((q:any,i:number)=>[q.id,{option:i===0?"a":"b"}]))});
  assert.equal(done.result.maximum,6);assert.equal(done.result.score,2.5);assert.equal(done.result.negative,0.5);assert.equal(mockMarkingGroups(done.result.questions).length,3);
  await setMockUser(db,null);await assert.rejects(api("save",{attemptId:a.id,guestToken:token,answers:{},sequence:999,compact:true}),/not found/);
 }finally{await db.close();}
});
