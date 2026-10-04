import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults.ts";
import { validateData } from "../src/services/validation.ts";

const built = await build({ entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ PROD: false, BASE_URL: "./" }) }, jsx: "automatic" });
const key = "upsc-command-center:v1", errors = [], vc = new VirtualConsole();
vc.on("jsdomError", e => { if (!String(e).includes("navigation")) errors.push(String(e)); });
const seed = createEmptyData(); seed.settings.year = 2027;
seed.settings.prelimsDate = ""; seed.settings.mainsDate = "";
delete seed.settings.examType; delete seed.settings.statePscName; delete seed.settings.statePscDate;
function open(saved, route="/") {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "https://example.test/upsc/#"+route, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, callbacks = new Map(); let clock = Date.parse("2026-10-03T16:01:33Z"), timerId = -1;
  const OriginalDate = w.Date;
  w.Date = class extends OriginalDate { constructor(...args) { if(args.length) super(...args); else super(clock); } static now() { return clock; } };
  const realInterval = w.setInterval.bind(w), realClear = w.clearInterval.bind(w);
  w.setInterval = (fn,ms,...args) => { if(ms !== 1000) return realInterval(fn,ms,...args); const id=timerId--; callbacks.set(id,()=>fn(...args)); return id; };
  w.clearInterval = id => { if(!callbacks.delete(id)) realClear(id); };
  w.localStorage.setItem(key,saved || JSON.stringify(seed)); w.structuredClone = structuredClone;
  w.fetch = async () => ({ ok:true, json:async()=>({url:"",publishableKey:""}) });
  w.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
  w.scrollTo = () => {}; w.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
  w.HTMLDialogElement.prototype.showModal = function(){this.setAttribute("open","");};
  w.HTMLDialogElement.prototype.close = function(){this.removeAttribute("open");};
  w.eval(built.outputFiles[0].text);
  return { dom,w,callbacks,data:()=>JSON.parse(w.localStorage.getItem(key)), tick:()=>{clock+=1000;for(const fn of callbacks.values())fn();} };
}
let current = open(); const opened = [current];
const wait = (ms=35) => new Promise(resolve=>setTimeout(resolve,ms));
const body = () => current.w.document.body.textContent;
const byLabel = label => current.w.document.querySelector(`[aria-label="${label}"]`);
const dialog = () => current.w.document.querySelector('dialog[open]');
async function until(predicate,message) { for(let i=0;i<150;i++){if(predicate())return;await wait();} assert.fail(message+": "+body().slice(-1000)); }
async function click(label,scope=current.w.document) {
  const el = [...scope.querySelectorAll("button")].find(el=>el.textContent.trim()===label || el.getAttribute("aria-label")===label);
  assert.ok(el && !el.disabled,"Missing enabled button: "+label); el.click(); await wait();
}
async function input(el,value) {
  assert.ok(el && !el.disabled); const w=current.w, prototype=el.tagName==="SELECT" ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,"value").set.call(el,value);
  el.dispatchEvent(new w.Event(el.tagName==="SELECT" ? "change" : "input",{bubbles:true})); await wait();
}
const field = (scope,label) => [...scope.querySelectorAll("label")].find(el=>el.firstChild?.textContent===label)?.querySelector("input");
async function route(path,title) { current.w.location.hash=path; await until(()=>current.w.document.querySelector("h1")?.textContent===title,"Route did not load "+path); }
try {
  await until(()=>body().includes("Set up your preparation workspace") || current.w.document.querySelector("h1")?.textContent==="Welcome back.","Workspace did not open");
  if(current.w.document.querySelector("h1")?.textContent==="Welcome back.") { await click("Continue as guest"); await until(()=>body().includes("Set up your preparation workspace"),"Setup did not load"); }
  await until(()=>byLabel("Exam selection"),"Exam selection missing from setup");
  await input(byLabel("Exam selection"),"State PSC"); await input(byLabel("State PSC exam name"),"BPSC 73rd CCE");
  await click("Continue"); await click("Continue"); await click("Continue");
  await until(()=>byLabel("State PSC exam date"),"Exam date step did not open");
  assert.equal(byLabel("State PSC exam date").required,true); await input(byLabel("State PSC exam date"),"2027-03-14");
  await click("Continue"); await click("Continue"); await click("Open dashboard");
  await until(()=>current.w.document.querySelector("h1")?.textContent==="STATE PSC PREPARATION WORKSPACE","State dashboard did not open");
  assert.equal(current.data().settings.examType,"State PSC"); assert.equal(current.data().settings.statePscName,"BPSC 73rd CCE");
  assert.equal(current.w.document.querySelectorAll('.exam-countdown').length,1);
  assert.match(current.w.document.querySelector('.exam-countdown').textContent,/BPSC 73rd CCE/);
  assert.match(current.w.document.querySelector('.exam-countdown-date').textContent,/14 March 2027|March 14, 2027/);
  assert.equal(current.callbacks.size,1);
  const initialSeconds = current.w.document.querySelector('.exam-countdown-digits > div:last-child strong').textContent;
  assert.equal(initialSeconds,"27"); current.tick(); await wait();
  assert.equal(current.w.document.querySelector('.exam-countdown-digits > div:last-child strong').textContent,"26");

  await click("Choose personal workspace exam"); await input(byLabel("Exam selection"),"UPSC CSE");
  assert.equal(field(dialog(),"Prelims date").value,"2027-05-23"); assert.equal(field(dialog(),"Mains date").value,"2027-08-20");
  await input(field(dialog(),"Prelims date"),"2027-05-24"); await click("Save exam");
  assert.equal(current.data().settings.statePscDate,"2027-03-14"); assert.equal(current.data().settings.prelimsDate,"2027-05-24");
  assert.equal(current.w.document.querySelectorAll('.exam-countdown').length,2);
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/CSE 2027 Prelims/);
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/24 May 2027|May 24, 2027/);
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/20 August 2027|August 20, 2027/);

  current = open(JSON.stringify(current.data())); opened.push(current);
  await until(()=>current.w.document.querySelector("h1")?.textContent==="UPSC PREPARATION COMMAND CENTER","Reloaded dashboard did not open");
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/24 May 2027|May 24, 2027/);
  await route("/settings","Preparation settings");
  await until(()=>current.callbacks.size===0,"Dashboard countdown timer did not stop after leaving the dashboard");
  assert.equal(current.callbacks.size,0);
  await input(byLabel("Exam selection"),"State PSC"); assert.equal(byLabel("State PSC exam date").value,"2027-03-14");
  await input(byLabel("State PSC exam name"),"UPPSC PCS 2027"); await input(byLabel("State PSC exam date"),"2027-04-11"); await click("Save settings");
  await route("/","STATE PSC PREPARATION WORKSPACE");
  assert.equal(current.w.document.querySelectorAll('.exam-countdown').length,1);
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/UPPSC PCS 2027/);
  assert.match(current.w.document.querySelector('.exam-countdowns').textContent,/11 April 2027|April 11, 2027/);
  await click("Choose personal workspace exam"); await input(byLabel("Exam selection"),"UPSC CSE"); await click("Cancel");
  assert.equal(current.data().settings.examType,"State PSC");
  validateData(current.data()); assert.deepEqual(errors,[]);
  console.log("Exam UI passed: State PSC setup, personal workspace selector, required exam name/date, one live State PSC countdown, second-by-second updates, editable 2027 CSE defaults, switching without data loss, saved choices after reload, timer cleanup and cancelled edits.");
} finally { for(const c of opened){c.callbacks.clear();c.dom.window.close();} }
