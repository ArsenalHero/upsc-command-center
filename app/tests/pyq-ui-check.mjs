import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyData } from "../src/data/defaults.ts";
import { validateData } from "../src/services/validation.ts";

const bank = JSON.parse(
  readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"),
);
const q1 = bank.find((q) => q.stage === "Prelims" && q.number === 1);
const q2 = bank.find((q) => q.stage === "Prelims" && q.number === 2);
const geography = JSON.parse(readFileSync(new URL("../src/data/geography-bank.json", import.meta.url), "utf8"));
const geo126 = geography.find(q => q.id === "geography-part-6-q-126");
const geo127 = geography.find(q => q.id === "geography-part-6-q-127");
const built = await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  loader: { ".css": "empty" },
  define: {
    "import.meta.env": JSON.stringify({ PROD: false, BASE_URL: "./" }),
  },
  jsx: "automatic",
});
const messages = [],
  vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  if (!String(e).includes("navigation")) messages.push(String(e));
});
const key = "upsc-command-center:v1";
function makeDOM(saved) {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    {
      url: "https://example.test/upsc/#/pyqs",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: vc,
    },
  );
  const w = dom.window;
  const empty = createEmptyData();
  empty.settings.setupCompleted = true;
  w.localStorage.setItem(key, saved || JSON.stringify(empty));
  w.structuredClone = structuredClone;
  w.fetch = async () => ({
    ok: true,
    json: async () => ({ url: "", publishableKey: "" }),
  });
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  w.scrollTo = () => {};
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  let now = 0,
    hidden = false;
  Object.defineProperty(w.performance, "now", { value: () => now });
  Object.defineProperty(w.document, "hidden", { get: () => hidden });
  w.eval(built.outputFiles[0].text);
  return {
    dom,
    w,
    advance(seconds) {
      now += seconds * 1000;
    },
    visibility(value) {
      hidden = value;
      w.document.dispatchEvent(new w.Event("visibilitychange"));
    },
    data() {
      return JSON.parse(w.localStorage.getItem(key));
    },
  };
}
let current = makeDOM();
const allDOMs = [current.dom];
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const text = () => current.w.document.body.textContent;
async function until(predicate, label) {
  for (let i = 0; i < 150; i++) {
    if (predicate()) return;
    await wait();
  }
  assert.ok(predicate(), label + ": " + text().slice(-1600));
}
async function heading(title) {
  await until(
    () => current.w.document.querySelector("h1")?.textContent === title,
    "Heading " + title,
  );
}
async function click(label) {
  const button = [...current.w.document.querySelectorAll("button")].find(
    (b) =>
      b.textContent.trim() === label || b.getAttribute("aria-label") === label,
  );
  assert.ok(
    button && !button.disabled,
    "Missing enabled button " + label + ": " + text().slice(-1600),
  );
  button.click();
  await wait();
}
async function field(label, value) {
  const w = current.w,
    el = w.document.querySelector(`[aria-label="${label}"]`);
  assert.ok(el, "Missing field " + label);
  const prototype =
    el.tagName === "SELECT"
      ? w.HTMLSelectElement.prototype
      : el.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, value);
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  await wait();
}
async function option(value) {
  const el = current.w.document.querySelector(
    `input[name="pyq-option"][value="${value}"]`,
  );
  assert.ok(el && !el.disabled);
  el.click();
  await wait();
}

try {
  await heading("PYQ question bank");
  assert.match(text(), /2,206 questions ready/);
  await field("PYQ paper", "Prelims GS-I");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"100 questions");
  await click("Practise filtered questions");
  await heading("2025 · Prelims GS-I");
  assert.equal(current.w.document.querySelector("svg image"),null);
  assert.equal(current.w.document.querySelector(".prelims-explanation"),null);
  current.advance(20); await option("a");
  await field("Question confidence","2");
  await field("Question mistake category","Conceptual");
  await field("Question notes","Revisit alternative funds");
  current.visibility(true); await wait();
  assert.equal(current.data().prelims.session.responses[q1.id].seconds,20);
  current.advance(300); current.visibility(false); await wait();
  current.advance(5); await click("Submit answer");
  assert.equal(current.data().pyqs.length,1);
  assert.equal(current.data().pyqs[0].attempt.outcome,"incorrect");
  assert.equal(current.data().pyqs[0].attempt.seconds,25);
  assert.equal(current.data().pyqs[0].attempt.confidence,2);
  assert.match(text(), /Official answer: B/);
  await field("Question notes","Updated after checking the key");
  assert.equal(current.data().pyqs[0].attempt.notes,"Updated after checking the key");
  assert.equal(current.data().pyqs.length,1);
  await click("Marked for review");
  assert.equal(current.data().pyqs[0].revisionNeeded,false);
  current.advance(30); await field("Question notes","No scoring or time change");
  assert.equal(current.data().pyqs[0].attempt.seconds,25);
  assert.equal(current.data().pyqs[0].revisionNeeded,false);
  await click("Next question"); assert.match(text(), /Original Q2/);
  current.advance(12); await option(q2.answer); await click("Save & exit");
  await heading("PYQ question bank");
  const saved=current.w.localStorage.getItem(key);
  assert.equal(current.data().prelims.session.responses[q2.id].seconds,12);
  current=makeDOM(saved); allDOMs.push(current.dom);
  await heading("PYQ question bank"); await click("Resume practice");
  await heading("2025 · Prelims GS-I");
  assert.equal(current.w.document.querySelector('input[name="pyq-option"]:checked').value,q2.answer);
  current.advance(3); await click("Submit answer");
  assert.equal(current.data().pyqs.length,2); assert.equal(current.data().pyqs[1].attempt.seconds,15);
  await click("Next question"); assert.ok(current.w.document.querySelector(".prelims-text table"));
  assert.match(text(), /Directorate of Enforcement/);
  current.advance(4); await click("Skip question");
  assert.equal(current.data().pyqs[2].attempt.outcome,"skipped");
  assert.equal(current.data().pyqs[2].attempt.seconds,4);
  await click("Finish practice"); await heading("Your paper report");
  assert.equal(current.data().prelims.reports.length,1);
  await click("Back to question bank"); await click("Revision");
  assert.match(text(), /Latest mistakes/); await click("Practise latest mistakes");
  await heading("2025 · Prelims GS-I"); await option(q1.answer); await click("Submit answer");
  assert.equal(current.data().pyqs.filter(p=>p.attempt.questionId===q1.id).length,2);
  await click("Finish practice"); await heading("Your paper report"); await click("Back to question bank");
  await click("Full papers");
  current.w.document.querySelector('.prelims-check input').click(); await wait();
  await click("Start GS test"); await heading("2025 · Prelims GS-I");
  assert.equal(current.data().prelims.session.questionIds.length,100);
  assert.equal(current.data().prelims.session.deadline,undefined);
  const before=current.data().pyqs.length;
  await option(q1.answer); current.advance(10); await click("Next question");
  await option(q2.answer); await click("Go to question 10");
  assert.equal(current.data().pyqs.length,before);
  assert.equal(current.w.document.querySelector(".prelims-explanation"),null);
  assert.ok(!text().includes("Official answer:"));
  await click("Mark for review"); await click("Save & exit"); await heading("PYQ question bank");
  await click("Resume test"); await heading("2025 · Prelims GS-I");
  assert.match(text(), /Original Q10/); await click("Finish test"); await heading("Your paper report");
  const report=current.data().prelims.reports.at(-1);
  assert.ok(report.endedAt); assert.equal(report.responses[q1.id].key.answer,q1.answer);
  assert.equal(report.responses[q1.id].seconds,10);
  assert.ok(current.data().pyqs.length>before);
  await click("Back to question bank"); await click("Full papers"); await click("Start CSAT test");
  await heading("2025 · CSAT Paper II");
  assert.equal(current.data().prelims.session.questionIds.length,80);
  assert.match(text(), /Maintaining an ecosystem/);
  await option("c"); await click("Finish test"); await heading("Your paper report");
  assert.equal(current.data().pyqs.at(-1).attempt.outcome,"correct");
  assert.equal(current.data().pyqs.at(-1).attempt.maximum,2.5);
  await click("Back to question bank"); await click("Browse");
  await field("PYQ paper","Prelims GS-I"); await field("Search PYQs","Bonds Hedge Funds");
  await click("Practise 2025 GS I Q1"); await heading("2025 · Prelims GS-I"); await option("a");
  const previous=current.data().pyqs.length, setItem=current.w.Storage.prototype.setItem;
  current.w.Storage.prototype.setItem=function(k,v){if(k===key)throw new Error("Storage quota full");return setItem.call(this,k,v);};
  await click("Submit answer");
  assert.equal(current.data().pyqs.length,previous);
  assert.equal(current.w.document.querySelector(".prelims-explanation"),null);
  current.w.Storage.prototype.setItem=setItem; await click("Submit answer");
  assert.equal(current.data().pyqs.length,previous+1);
  assert.equal(new Set(current.data().pyqs.map(p=>p.id)).size,current.data().pyqs.length);
  await click("Finish practice"); await heading("Your paper report"); await click("Back to question bank");
  await click("Browse"); await field("Search PYQs", ""); await click("Practise 2025 GS I Q1"); await heading("2025 · Prelims GS-I");
  assert.equal(current.data().prelims.session.questionIds.length, 100);
  current.w.document.querySelector('[aria-label="Automatically open next question after submit"]').click(); await wait();
  const autoBefore=current.data().pyqs.length; await option(q1.answer); await click("Submit answer");
  assert.equal(current.data().prelims.session.index, 1); assert.equal(current.data().pyqs.length, autoBefore+1); assert.match(text(), /Original Q2/);
  assert.equal(current.data().prelims.autoAdvance, true);
  const expired=current.data();
  const old=expired.prelims.session;
  expired.prelims.session={...old,id:"expired-test",mode:"test",deadline:"2026-01-01T02:00:00Z",startedAt:"2026-01-01T00:00:00Z",responses:{[q1.id]:{option:"",seconds:0,confidence:3,errorType:"",notes:"",submitted:false,visited:true,review:false}}};
  delete expired.prelims.session.endedAt;
  current=makeDOM(JSON.stringify(expired)); allDOMs.push(current.dom);
  await heading("PYQ question bank"); await click("Resume test"); await heading("Your paper report");
  assert.ok(current.data().prelims.session.endedAt);
  assert.equal(current.data().prelims.reports.at(-1).id,"expired-test");
  current=makeDOM(); allDOMs.push(current.dom);
  await heading("PYQ question bank"); await click("Polity & Governance"); await click("State PSC");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"571 questions");
  await field("PYQ state","Chhattisgarh"); await field("PYQ year","2016");
  await field("Search PYQs","POL5");
  await click("Practise CGPSC 2016 · Part 5 Q101");
  await heading("2016 · CGPSC · Polity MCQs");
  assert.equal(current.w.document.querySelectorAll('input[name="pyq-option"]').length,5);
  assert.equal(current.w.document.querySelector(".prelims-explanation"),null);
  current.advance(19); await option("e"); await click("Submit answer");
  assert.match(text(), /Provided answer: E/); assert.match(text(), /Explanation from supplied material/);
  const imported=current.data().pyqs.at(-1);
  assert.equal(imported.attempt.selectedOption,"e"); assert.equal(imported.attempt.outcome,"correct");
  assert.equal(imported.attempt.grading,"provided"); assert.equal(imported.attempt.seconds,19);
  assert.equal(imported.attempt.examGroup,"State PSC"); assert.equal(imported.attempt.examState,"Chhattisgarh");
  assert.equal(imported.attempt.sourceFile,"POL5.txt");
  validateData(current.data());
  await click("Next question");
  assert.notEqual(current.data().prelims.session.index,0);
  await click("Save & exit"); await heading("PYQ question bank");
  current=makeDOM(current.w.localStorage.getItem(key)); allDOMs.push(current.dom);
  await heading("PYQ question bank");
  assert.equal(current.data().prelims.filters.examGroup,"State PSC");
  assert.equal(current.data().prelims.filters.year,"2016");
  assert.equal(current.data().pyqs.at(-1).attempt.selectedOption,"e");
  await click("Resume practice"); await click("Finish practice"); await heading("Your paper report");
  assert.match(text(), /1 right/); assert.match(text(), /penalty 0/);
  await click("Back to question bank"); await click("Unlabelled");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"1 questions");
  assert.match(text(), /Year not supplied/);
  await click("CDS & CAPF");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"330 questions");
  assert.deepEqual([...current.w.document.querySelector('[aria-label="PYQ state"]').options].map(o=>o.value),[""]);
  current=makeDOM(); allDOMs.push(current.dom);
  await heading("PYQ question bank"); await click("Geography");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"865 questions");
  await click("UPSC CSE");
  assert.equal(current.data().prelims.filters.subject,"Geography");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"234 questions");
  await field("PYQ year","2025");
  assert.ok(current.w.document.querySelectorAll(".prelims-bank-row").length);
  assert.ok([...current.w.document.querySelectorAll(".prelims-bank-row .eyebrow")].every(el => el.textContent.includes("2025")));
  await click("State PSC");
  assert.equal(current.data().prelims.filters.subject,"Geography");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"383 questions");
  await field("PYQ state","Bihar"); await field("Search PYQs","GEO6 126");
  await click("Practise BPSC 2019 · Geography · Part 6 Q126");
  await heading("2019 · BPSC · Geography MCQs");
  assert.equal(current.w.document.querySelectorAll('input[name="pyq-option"]').length,5);
  assert.equal(current.w.document.querySelector(".prelims-explanation"),null);
  current.advance(27); await option("e"); await click("Submit answer");
  assert.match(text(), /Provided answer: D/);
  assert.equal(current.w.document.querySelector(".prelims-provided-text").textContent,geo126.explanation.justification);
  const geoAttempt=current.data().pyqs.at(-1);
  assert.equal(geoAttempt.attempt.outcome,"incorrect"); assert.equal(geoAttempt.attempt.seconds,27);
  assert.equal(geoAttempt.attempt.examState,"Bihar");
  assert.equal(geoAttempt.attempt.sourceFile,"GEO6(1).txt");
  assert.equal(geoAttempt.paper,"BPSC · Geography MCQs");
  await click("Next question"); await heading("2017 · BPSC · Geography MCQs");
  assert.match(text(), /Source Q127/);
  current.advance(11); await option(geo127.answer); await click("Submit answer");
  assert.equal(current.data().pyqs.at(-1).attempt.outcome,"correct");
  assert.equal(current.data().pyqs.at(-1).attempt.seconds,11);
  await click("Save & exit"); await heading("PYQ question bank");
  current=makeDOM(current.w.localStorage.getItem(key)); allDOMs.push(current.dom);
  await heading("PYQ question bank");
  assert.equal(current.data().prelims.filters.subject,"Geography");
  assert.equal(current.data().pyqs.at(-2).attempt.seconds,27);
  validateData(current.data());
  await click("Resume practice"); await click("Finish practice"); await heading("Your paper report");
  assert.match(text(), /1 right/); assert.match(text(), /1 wrong/); assert.match(text(), /penalty 0/);
  await click("Back to question bank"); await field("Search PYQs","");
  await field("PYQ paper","BPSC · Geography MCQs"); await click("Polity & Governance");
  assert.equal(current.data().prelims.filters.paper,"");
  assert.ok(!text().includes("No questions match these filters."));
  await click("Geography"); await click("CDS & CAPF");
  assert.equal(current.data().prelims.filters.subject,"Geography");
  assert.equal(current.w.document.querySelector(".section-heading h2").textContent,"248 questions");
  assert.deepEqual([...current.w.document.querySelector('[aria-label="PYQ state"]').options].map(o=>o.value),[""]);
  assert.deepEqual(messages,[]);
  console.log("PYQ UI passed: original papers, Polity and Geography, subject/exam/year filters, five-choice grading, exact supplied explanations, saved time, reload, Next question, reports and CDS/CAPF separation.");
} finally { for(const dom of allDOMs) dom.window.close(); }
