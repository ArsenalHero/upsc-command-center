import test from "node:test";
import assert from "node:assert/strict";
import { createMockSaveQueue } from "../src/services/mockSaveQueue";

type Snapshot={sequence:number;answers:Record<string,string>;index:number};
const snapshot=(sequence:number):Snapshot=>({sequence,answers:{q1:"a",q2:sequence>2?"b":""},index:sequence});
const receipt=(sequence:number)=>({id:"attempt",status:"running" as const,sequence});
const deferred=<T>()=>{let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test("rapid navigation coalesces unsent edits and never queues every intermediate answer",async()=>{
 const requests:Snapshot[]=[],acks:number[]=[];
 const gate=deferred<ReturnType<typeof receipt>>();
 const queue=createMockSaveQueue<Snapshot>({delay:10000,save:async s=>{requests.push(s);return requests.length===1?gate.promise:receipt(s.sequence);},onSaved:r=>acks.push(r.sequence),onError:()=>assert.fail("Unexpected error")});
 try{
  queue.enqueue(snapshot(1));const flush=queue.flush();
  for(let n=2;n<=100;n++)queue.enqueue(snapshot(n));
  assert.deepEqual(requests.map(s=>s.sequence),[1],"Local edits continue while the first request is held");
  gate.resolve(receipt(1));await flush;
  assert.deepEqual(requests.map(s=>s.sequence),[1,100]);
  assert.equal(requests[1].answers.q2,"b");assert.equal(requests[1].index,100);
  assert.deepEqual(acks,[1,100]);
 }finally{queue.dispose();}
});
test("a failed old save retains the newer complete snapshot for retry",async()=>{
 const gate=deferred<ReturnType<typeof receipt>>(),requests:Snapshot[]=[],errors:unknown[]=[];
 const queue=createMockSaveQueue<Snapshot>({delay:10000,save:async s=>{requests.push(s);return requests.length===1?gate.promise:receipt(s.sequence);},onSaved:()=>{},onError:e=>errors.push(e)});
 try{
  queue.enqueue(snapshot(1));const flush=queue.flush();queue.enqueue(snapshot(3));
  gate.reject(Error("Offline"));await assert.rejects(flush,/Offline/);
  await queue.flush();assert.deepEqual(requests.map(s=>s.sequence),[1,3]);assert.equal(errors.length,1);
 }finally{queue.dispose();}
});
test("submission can cancel unsent background saves and disposal ignores a late acknowledgement",async()=>{
 const gate=deferred<ReturnType<typeof receipt>>(),requests:number[]=[],acks:number[]=[];
 const queue=createMockSaveQueue<Snapshot>({delay:10000,save:async s=>{requests.push(s.sequence);return gate.promise;},onSaved:r=>acks.push(r.sequence),onError:()=>{}});
 queue.enqueue(snapshot(1));const flush=queue.flush();queue.enqueue(snapshot(2));queue.cancelPending();queue.dispose();gate.resolve(receipt(1));await flush;
 assert.deepEqual(requests,[1]);assert.deepEqual(acks,[]);
});
