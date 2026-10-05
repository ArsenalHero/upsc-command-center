import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { reverseInstituteDisplayName,importMockQuestions,parseMockCSV } from "../src/utils/mockLab";
test("institute spelling reverses individual words only; CSV supports quoted explanations and rejects repeats",()=>{
 for(const [a,b] of [["FORUM IAS","MUROF SAI"],["RAU'S IAS","S'UAR SAI"],["VAJIRAM & RAVI IAS","MARIJAV & IVAR SAI"],["NEXT-IAS / NEW","TXEN-SAI / WEN"]])assert.equal(reverseInstituteDisplayName(a),b);
 assert.equal(parseMockCSV('Question,Explanation\r\n"A, B?","First line\nSecond ""quoted"" line"')[0].explanation,'First line\nSecond "quoted" line');
 const row={question:"Which item is correct?",options:{a:"First",b:"Second",c:"Third",d:"Fourth"},correct:"a",explanation:"The first choice is the correct item.",subject:"Polity",topic:"Institutions"};
 assert.equal(importMockQuestions(JSON.stringify([row]))[0].correct,"a");assert.throws(()=>importMockQuestions(JSON.stringify([row,row])),/repeats/);
});
test("real Postgres API isolates answers, scores on the server, locks first attempts and protects participant privacy",async()=>{
 const db=new PGlite();const admin="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222",eve="33333333-3333-4333-8333-333333333333";
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; insert into auth.users values('${admin}',now(),false,'{"mock_admin":true}'),('${bob}',now(),false,'{}'),('${eve}',now(),false,'{}');`);
 await db.exec(readFileSync(new URL("../supabase/sql/mock-lab.sql",import.meta.url),"utf8"));
 const as=async(user:string|null)=>{await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user||""}',false); set role ${user?"authenticated":"anon"};`);};
 const api=async(op:string,p:unknown={})=>(await db.query<{data:any}>("select public.mock_lab($1,$2::jsonb) data",[op,JSON.stringify(p)])).rows[0].data;
 await as(null);assert.deepEqual((await api("catalog")).tests,[]);await assert.rejects(api("start"),/Sign in/);
 await as(admin);await api("profile",{displayName:"MockManager"});const coaching=await api("admin-coaching",{name:"FORUM IAS"});assert.equal(coaching.name,"MUROF SAI");
 const questions=["Alpha","Beta","Gamma"].map(topic=>({question:`Question ${topic}: which choice is correct?`,options:{a:"One",b:"Two",c:"Three",d:"Four"},correct:"a",explanation:"Choice one is the correct answer based on the stated premise.",subject:"Polity",topic,positive:2,negative:0.5}));
 const testId=(await api("admin-test",{code:"UNIT-GS",name:"Backend Test",paper:"GS-I",kind:"Sectional",year:2027,series:"Validation",duration:30,positive:2,negative:0.5,status:"active",coachingId:coaching.id,questions})).id;
 await as(null);const catalog=await api("catalog");assert.equal(catalog.tests[0].question_count,3);assert.ok(!JSON.stringify(catalog).includes('"correct":'));assert.ok(!JSON.stringify(catalog).includes("FORUM IAS"));
 await as(bob);await assert.rejects(api("admin-test",{}),/Administrator/);await api("profile",{displayName:"LearnerB"});const attempt=await api("start",{testId});assert.equal(attempt.eligible,true);assert.ok(!JSON.stringify(attempt.questions).includes('"correct":'));assert.ok(!JSON.stringify(attempt.questions).includes("explanation"));
 assert.equal((await api("start",{testId})).id,attempt.id);
 const ids=attempt.questions.map((q:any)=>q.id);const answers={[ids[0]]:{option:"a",visited:true,seconds:2},[ids[1]]:{option:"b",visited:true,seconds:3}};
 await api("save",{attemptId:attempt.id,sequence:1,index:1,answers});await api("save",{attemptId:attempt.id,sequence:1,index:0,answers:{}});assert.equal((await api("attempt",{attemptId:attempt.id})).answers[ids[0]].option,"a");
 await assert.rejects(api("save",{attemptId:attempt.id,sequence:2,answers:{[ids[0]]:{option:"z"}}}),/Invalid answer/);
 await as(eve);await assert.rejects(api("attempt",{attemptId:attempt.id}),/not found/);await assert.rejects(api("leaderboard",{testId}),/Join/);await assert.rejects(db.query("select * from mock_private.attempts"),/permission denied/);
 await as(bob);const done=await api("submit",{attemptId:attempt.id,score:999999,eligible:false});assert.equal(done.result.score,1.5);assert.equal(done.result.correct,1);assert.equal(done.result.incorrect,1);assert.equal(done.result.unattempted,1);assert.equal(done.result.accuracy,50);assert.ok(done.questions[0].correct);assert.equal(done.position.rank,1);assert.equal(done.position.percentile,50);assert.equal(done.community.mean,undefined);
 assert.equal((await api("submit",{attemptId:attempt.id})).result.score,1.5);const practice=await api("start",{testId});assert.equal(practice.eligible,false);await api("submit",{attemptId:practice.id,answers:Object.fromEntries(practice.questions.map((q:any)=>[q.id,{option:"a"}])),sequence:1});assert.equal((await api("leaderboard",{testId})).mine.score,1.5);
 const board=JSON.stringify(await api("leaderboard",{testId}));for(const hidden of ["user_id","attempt_id",bob,"note","email"])assert.ok(!board.includes(hidden));
 await api("annotate",{attemptId:attempt.id,questionId:ids[1],note:"Private note",errorType:"Concept Gap",bookmarked:true,revisionDate:"2026-10-12"});assert.equal((await api("notebook"))[0].question.response.note,"Private note");assert.equal((await api("notebook",{selection:"bookmarks"})).length,1);
 await as(bob);await api("bookmark-test",{testId});assert.equal((await api("catalog",{participation:"Bookmarked"})).tests.length,1);const totals=await api("summary");assert.equal(totals.mocks,2);assert.equal(totals.fullLength,0);assert.ok(totals.weakTopics.length);
 for(let n=4;n<=7;n++){const person=`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;await db.exec("reset role");await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())",[person]);await as(person);await api("profile",{displayName:`Learner${n}`});const run=await api("start",{testId});await api("submit",{attemptId:run.id,sequence:1,answers:Object.fromEntries(run.questions.map((q:any)=>[q.id,{option:n===4?"b":"a"}]))});}
 await as(bob);const community=(await api("attempt",{attemptId:attempt.id})).community;assert.equal(community.participants,5);assert.ok(community.histogram.length>0);assert.equal(community.curve.length,101);assert.ok(community.sample.some((row:any)=>row.mine));assert.ok(!JSON.stringify(community.sample).includes(bob));
 await as(admin);await assert.rejects(api("admin-test",{id:testId,code:"UNIT-GS",name:"Changed",paper:"GS-I",kind:"Sectional",year:2027,duration:30,questions}),/immutable/);
 await as(bob);const review=await api("start",{selection:"mistakes",paper:"GS-I"});assert.equal(review.eligible,false);assert.equal(review.questions.length,1);assert.equal(review.testId,null);
 await db.exec("reset role");await db.query("update mock_private.attempts set deadline=now()-interval '1 second' where id=$1",[review.id]);await as(bob);const expired=await api("attempt",{attemptId:review.id});assert.equal(expired.status,"submitted");assert.equal(expired.result.unattempted,1);
 }finally{await db.close();}
});
