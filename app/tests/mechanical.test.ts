import test from "node:test";
import assert from "node:assert/strict";
import { answerMechanical, canGradeMechanical, emptyMechanical, filterMechanical, finishMechanical, flagMechanical, loadMechanicalSubject, mechanicalSummary, startMechanical, validateMechanical, type MechanicalQuestion, type MechanicalSubject } from "../src/utils/mechanical";
import { createEmptyData } from "../src/data/defaults";
import { validateData } from "../src/services/validation";
import { CloudWorkspaceRepository, type RemoteWorkspace, type WorkspaceTransport } from "../src/services/cloudRepository";

const now="2026-11-14T10:00:00.000Z";
const question=(n:number,patch:Partial<MechanicalQuestion>={}):MechanicalQuestion=>({id:`mech-test-${n}`,number:n,subjectId:"engineering-mechanics",subject:"Engineering Mechanics",topic:"Forces",subtopic:"Vectors",question:`Question ${n}`,options:{a:"First",b:"Second",c:"Third",d:"Fourth",e:"Fifth"},answer:"e",sourceAnswer:"a",explanation:"Complete supplied reasoning.",source:{file:"selected.pdf",page:1,printedPage:15,sha256:"test"},review:{status:"corrected",note:"Printed key corrected.",references:[]},...patch});

test("only structurally complete, reviewed questions are graded",()=>{
  const q=question(1);assert.equal(canGradeMechanical(q),true);
  for(const patch of [{review:{...q.review,status:"disputed" as const},answer:null},{review:{...q.review,status:"needs-review" as const}},{transcriptionIssues:["Missing formula"]},{figures:[{alt:"Pending diagram",placement:"question" as const}]},{answer:"f"}])assert.equal(canGradeMechanical({...q,...patch}),false);
  const pool=[q,question(2,{answer:null,review:{...q.review,status:"disputed"}})];
  let w=startMechanical(emptyMechanical(),pool,2,false,false,now);w=answerMechanical(w,pool[0],"e",now);w=answerMechanical(w,pool[1],"b",now);
  assert.deepEqual(mechanicalSummary(w.latest),{total:2,answered:2,correct:1,incorrect:0,skipped:0,ungraded:1,accuracy:100});
});

test("five choices, final responses and historical answer snapshots survive a later key change",()=>{
  const q=question(1);let w=startMechanical(emptyMechanical(),[q],1,true,false,now);
  assert.throws(()=>answerMechanical(w,q,"f",now),/supplied answer/);
  w=answerMechanical(w,q,"e",now);assert.equal(w.history.length,1);assert.equal(w.history[0].responses[q.id].key,"e");
  assert.equal(answerMechanical({...w,session:{...w.session!,completedAt:undefined}},q,"a",now).latest[q.id].option,"e");
  const newer={...q,answer:"b"};assert.equal(w.history[0].responses[newer.id].outcome,"correct");
  assert.notEqual(w.history[0],w.session);validateMechanical(w);
});

test("omitted printed choices can be reviewed without inventing an answer or a skip",()=>{
  const q=question(348,{options:{},optionsUnavailable:true,answer:null,review:{status:"disputed",note:"Printed choices absent.",references:[]}});
  const w=answerMechanical(startMechanical(emptyMechanical(),[q],1,false,false,now),q,null,now);
  assert.equal(w.latest[q.id].outcome,"ungraded");assert.equal(mechanicalSummary(w.latest).accuracy,null);
  assert.throws(()=>answerMechanical(startMechanical(emptyMechanical(),[question(1)],1,false,false,now),question(1),null,now),/supplied answer/);
});

test("fresh practice excludes checked and skipped questions and preserves an unfinished set",()=>{
  const pool=[question(1),question(2),question(3)];let w=startMechanical(emptyMechanical(),pool,2,true,false,now);
  assert.throws(()=>startMechanical(w,pool,1),/Resume or finish/);
  w=answerMechanical(w,pool[0],"e",now);w=finishMechanical(w,now);
  assert.equal(w.latest[pool[1].id].outcome,"skipped");assert.equal(w.history.length,1);
  const next=startMechanical(w,pool,1,true,false,now);assert.deepEqual(next.session!.questionIds,[pool[2].id]);
  assert.throws(()=>startMechanical(w,pool,2,true,false,now),/Only 1 fresh/);
  assert.throws(()=>startMechanical(w,pool,1.5),/whole number/);
});

test("flags, saved-answer filters and validated workspace backups retain their data",()=>{
  const q=question(1);let w=answerMechanical(startMechanical(emptyMechanical(),[q],1,false,false,now),q,"a",now);w=flagMechanical(w,q.id);
  assert.deepEqual(filterMechanical([q],{...w.filters,status:"incorrect"},w),[q]);assert.deepEqual(filterMechanical([q],{...w.filters,status:"flagged"},w),[q]);
  const data=createEmptyData();data.mechanical=w;assert.deepEqual(validateData(JSON.parse(JSON.stringify(data))).mechanical,w);
  assert.throws(()=>validateMechanical({...w,flags:[q.id,q.id]}));
  assert.throws(()=>validateMechanical({...w,session:{...w.session,index:50}}));
  assert.throws(()=>validateMechanical({...w,latest:{[q.id]:{...w.latest[q.id],outcome:"made-up"}}}));
  assert.equal(flagMechanical(w,q.id).flags.length,0);
});

test("subject loading shares requests but refreshes fingerprints and retries failures",async()=>{
  const originalFetch=globalThis.fetch,originalDocument=globalThis.document;let calls=0,fail=false;
  Object.assign(globalThis,{document:{baseURI:"https://example.test/upsc/"}});
  globalThis.fetch=async()=>{calls++;if(fail){fail=false;throw Error("Temporary failure");}return new Response(JSON.stringify({subjectId:"engineering-mechanics",questions:[question(1)]}));};
  const subject=(suffix:string):MechanicalSubject=>({id:"engineering-mechanics",title:"Engineering Mechanics",url:`mechanical/test-${suffix}.json`,count:1,reviewed:1,corrected:0,disputed:0,topics:[]});
  try{
    const s=subject("one");const [a,b]=await Promise.all([loadMechanicalSubject(s),loadMechanicalSubject(s)]);assert.equal(calls,1);assert.equal(a,b);
    await loadMechanicalSubject(subject("two"));assert.equal(calls,2);
    fail=true;await assert.rejects(()=>loadMechanicalSubject(subject("retry")),/Temporary failure/);await loadMechanicalSubject(subject("retry"));assert.equal(calls,4);
  }finally{globalThis.fetch=originalFetch;Object.assign(globalThis,{document:originalDocument});}
});

test("private account workspace roundtrips Mechanical flags, results and history",async()=>{
  let cloud:RemoteWorkspace|null=null;const remote:WorkspaceTransport={async read(){return cloud&&structuredClone(cloud);},async write(data,expected){assert.equal(expected,cloud?.revision??0);cloud={data:structuredClone(data),revision:expected+1,updatedAt:now};return structuredClone(cloud);}};
  const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
  const repo=await CloudWorkspaceRepository.open("mechanical-owner",remote,storage),data=repo.load(),q=question(1);
  data.mechanical=flagMechanical(answerMechanical(startMechanical(emptyMechanical(),[q],1,false,false,now),q,"e",now),q.id);repo.save(data);assert.equal(await repo.flush(),true);repo.dispose();
  const reopened=await CloudWorkspaceRepository.open("mechanical-owner",remote,storage);assert.deepEqual(reopened.load().mechanical,data.mechanical);reopened.dispose();
  const emptyRemote:WorkspaceTransport={async read(){return null;},async write(){throw Error("Unexpected write");}};
  const other=await CloudWorkspaceRepository.open("different-owner",emptyRemote,storage);assert.equal(other.load().mechanical,undefined);other.dispose();
});
