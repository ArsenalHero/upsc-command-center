import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults.ts";
import { addDays, dateKey, prettyDate } from "../src/utils/date.ts";
import { validateData } from "../src/services/validation.ts";

const built = await build({ entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ PROD: false, BASE_URL: "./" }) }, jsx: "automatic" });
const messages = [], vc = new VirtualConsole();
vc.on("jsdomError", e => { if (!String(e).includes("navigation")) messages.push(String(e)); });
const key = "upsc-command-center:v1", today = dateKey(), seed = createEmptyData();
seed.settings.setupCompleted = true;
delete seed.settings.spacedRepetition;
seed.revisions = seed.topics.slice(0,3).map((t,i) => ({ id: `review-${i+1}`, topicId: t.id, subjectId: t.subjectId, dueDate: today, completedDate: "", stage: "Revision 1", notes: "Recall from memory" }));
function makeDOM(saved) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "https://example.test/upsc/#/revision", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.localStorage.setItem(key, saved || JSON.stringify(seed));
  w.structuredClone = structuredClone;
  w.fetch = async () => ({ ok: true, json: async () => ({ url: "", publishableKey: "" }) });
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function() { this.removeAttribute("open"); };
  w.eval(built.outputFiles[0].text);
  return { dom, w, data: () => JSON.parse(w.localStorage.getItem(key)) };
}
let current = makeDOM(); const doms = [current.dom];
const wait = (ms=30) => new Promise(resolve => setTimeout(resolve,ms));
const text = () => current.w.document.body.textContent;
async function ready() {
  for(let i=0;i<150;i++) { if(current.w.document.querySelector("h1")?.textContent === "Revision planner") return; await wait(); }
  assert.fail("Revision page failed to load: "+text().slice(-1000));
}
async function click(label, scope=current.w.document) {
  const el = [...scope.querySelectorAll("button")].find(el => el.textContent.trim() === label || el.getAttribute("aria-label") === label);
  assert.ok(el && !el.disabled,"Missing button: "+label); el.click(); await wait();
}
async function radio(enabled) {
  const el = current.w.document.querySelector(`[aria-label="Spaced repetition ${enabled ? "on" : "off"}"]`);
  assert.ok(el); el.click(); await wait();
}
async function setInput(el,value) {
  assert.ok(el && !el.disabled); const w=current.w;
  const prototype = el.tagName === "SELECT" ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,"value").set.call(el,value);
  el.dispatchEvent(new w.Event(el.tagName === "SELECT" ? "change" : "input",{bubbles:true})); await wait();
}
const interval = () => current.w.document.querySelector('[aria-label="Repetition interval in days"]');
const agenda = () => current.w.document.querySelector(".revision-agenda");
try {
  await ready();
  assert.equal(current.w.document.querySelector('[aria-label="Spaced repetition off"]').checked,true);
  assert.equal(interval().disabled,true);
  await radio(true); await setInput(interval(),"0");
  assert.equal(current.w.document.querySelector('.spaced-repetition button[type="submit"]').disabled,true);
  assert.equal(current.data().settings.spacedRepetition,undefined);
  await setInput(interval(),"7"); await click("Save settings");
  assert.deepEqual(current.data().settings.spacedRepetition,{enabled:true,days:7});
  assert.match(text(),/Saved interval: 7 days/);

  const originalSet = current.w.Storage.prototype.setItem;
  current.w.Storage.prototype.setItem = function(k,v) { if(k===key) throw Error("Storage quota full"); return originalSet.call(this,k,v); };
  await click("Complete",agenda());
  assert.equal(current.data().revisions[0].completedDate,""); assert.equal(current.data().revisions.length,3);
  current.w.Storage.prototype.setItem = originalSet;
  await click("Complete",agenda());
  let repeated = current.data().revisions.find(r => r.repeatOf === "review-1");
  assert.ok(repeated); assert.equal(repeated.dueDate,addDays(today,7));
  assert.equal(current.data().revisions[0].completedDate,today); assert.equal(current.data().revisions.length,4);
  assert.match(text(),/Next revision:/);

  current = makeDOM(current.w.localStorage.getItem(key)); doms.push(current.dom); await ready();
  assert.equal(current.w.document.querySelector('[aria-label="Spaced repetition on"]').checked,true);
  assert.equal(interval().value,"7"); assert.equal(current.data().revisions.length,4);
  const calendarDay = [...current.w.document.querySelectorAll(".calendar-day")].find(el => el.getAttribute("aria-label").startsWith(prettyDate(addDays(today,7),{day:"numeric",month:"long"})+","));
  assert.ok(calendarDay); calendarDay.click(); await wait();
  assert.match(agenda().textContent,/Spaced repetition/);
  assert.match(agenda().textContent,new RegExp(seed.topics[0].name));
  await radio(false); await click("Save settings");
  assert.equal(current.data().revisions.length,4);
  await click("Complete",agenda());
  assert.equal(current.data().revisions.length,4);
  assert.equal(current.data().revisions.find(r=>r.id===repeated.id).completedDate,today);

  await radio(true); await setInput(interval(),"3"); await click("Save settings"); await click("Today");
  await click("Complete",agenda());
  repeated = current.data().revisions.find(r => r.repeatOf === "review-2");
  assert.equal(repeated.dueDate,addDays(today,3)); assert.equal(current.data().revisions.length,5);
  await click("Reschedule",agenda());
  const dateLabel = [...current.w.document.querySelectorAll("dialog[open] label")].find(el=>el.querySelector("span")?.textContent==="Completed date (leave empty if pending)");
  await setInput(dateLabel.querySelector("input"),today); await click("Save changes");
  assert.equal(current.data().revisions.find(r => r.repeatOf === "review-3").dueDate,addDays(today,3));
  assert.equal(current.data().revisions.length,6);
  const completedRow = [...current.w.document.querySelectorAll(".record-table tbody tr")].find(el=>el.textContent.includes(seed.topics[0].name));
  assert.ok(completedRow); await click("Edit Revision",completedRow); await click("Save changes");
  assert.equal(current.data().revisions.length,6);
  validateData(current.data()); assert.deepEqual(messages,[]);
  console.log("Revision UI passed: opt-in radio controls, custom interval, invalid input, atomic save failure/retry, automatic dates, calendar visibility, reload, changed interval, disabling and completed-record edits.");
} finally { for(const dom of doms) dom.window.close(); }
