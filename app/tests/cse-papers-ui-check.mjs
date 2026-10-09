import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults.ts";

const built = await build({ entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ PROD: false }) }, jsx: "automatic" });
const errors = [];
const createWindow = (saved) => {
  const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e)));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://example.test/upsc-command-center/#/pyqs", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.structuredClone = globalThis.structuredClone;
  w.fetch = async () => ({ ok: true, json: async () => ({ url: "", publishableKey: "" }) });
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.localStorage.setItem("upsc-command-center:v1", saved);
  w.eval(built.outputFiles[0].text);
  return w;
};
const d = createEmptyData(); d.settings.setupCompleted = true;
let w = createWindow(JSON.stringify(d));
const text = () => w.document.body.textContent;
const saved = () => JSON.parse(w.localStorage.getItem("upsc-command-center:v1"));
const wait = () => new Promise(r => setTimeout(r, 40));
const until = async (predicate, message) => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await wait(); }
  assert.ok(predicate(), `${message}; page: ${text().slice(-1500)}`);
};
const click = async (value, aria = false) => {
  const el = [...w.document.querySelectorAll("button")].find(b => aria ? b.getAttribute("aria-label") === value : b.textContent.trim() === value);
  assert.ok(el, `Missing button ${value}`); assert.equal(el.disabled, false); el.click(); await wait();
};
const papers = async () => { await until(() => w.document.querySelector("h1")?.textContent === "PYQ question bank", "Question bank did not load"); await click("Full papers"); };
const choose = async (option) => { const el = w.document.querySelector(`input[name="pyq-option"][value="${option}"]`); assert.ok(el); el.click(); await wait(); };
const finish = async (mode) => { await click(`Finish ${mode}`); await until(() => w.document.querySelector("h1")?.textContent === "Your paper report", "Report did not save"); };

await papers();
assert.deepEqual([...w.document.querySelectorAll(".paper-year")].map(el => el.querySelector("h3").textContent), ["2025", "2024", "2023", "2022", "2021", "2020", "2019"]);
for (const year of [2025, 2020, 2019]) {
  const section = w.document.querySelector(`[aria-label="${year} Civil Services papers"]`);
  assert.match(section.textContent, /100 questions/); assert.match(section.textContent, /80 questions/);
}

// The new GS paper uses the existing 2025 editor, saved progress and report.
await click("Practise 2020 GS paper", true);
assert.equal(saved().prelims.session.questionIds.length, 100);
assert.equal(saved().prelims.session.deadline, undefined);
await choose("c"); await click("Bookmark question");
const notes = w.document.querySelector('[aria-label="Question notes"]');
Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, "value").set.call(notes, "Revise fertigation");
notes.dispatchEvent(new w.Event("input", { bubbles: true })); await wait();
await click("Submit answer");
assert.match(text(), /Correct answer/);
assert.ok(w.document.querySelector('[aria-label="Answer and explanation"]'));
await click("Go to question 42", true); await choose("b"); await click("Submit answer");
assert.match(text(), /Dropped by UPSC · excluded from scoring/);
await click("Save & exit");
assert.equal(saved().prelims.session.index, 41);
const persisted = w.localStorage.getItem("upsc-command-center:v1"); w.close(); w = createWindow(persisted);
await until(() => text().includes("Resume practice"), "Saved paper did not reload");
await click("Resume practice");
assert.match(text(), /Question 42 of 100/);
assert.equal(w.document.querySelector('input[value="b"][name="pyq-option"]').checked, true);
await click("Go to question 1", true);
assert.equal(w.document.querySelector('[aria-label="Question notes"]').value, "Revise fertigation");
assert.match(text(), /Bookmarked/);
await finish("practice");
assert.match(w.document.querySelector(".prelims-result-legend").textContent, /2 dropped · excluded/);
assert.equal(saved().prelims.reports.length, 1);
assert.ok(saved().prelims.reports[0].endedAt);
assert.equal(saved().pyqs.find(p => p.attempt.questionNumber === 42).attempt.maximum, 0);

await click("Back to question bank"); await papers();
await click("Practise 2019 GS paper", true);
await choose("d"); await click("Submit answer"); assert.match(text(), /Correct answer/);
await finish("practice"); await click("Back to question bank"); await papers();

await click("Start 2019 CSAT test", true);
let s = saved().prelims.session;
assert.equal(s.questionIds.length, 80);
assert.equal(Date.parse(s.deadline) - Date.parse(s.startedAt), 7200000);
assert.ok(w.document.querySelector('[aria-label="Test time remaining"]'));
assert.equal(w.document.querySelector('[aria-label="Answer and explanation"]'), null);
await choose("c"); await click("Go to question 13", true);
assert.ok(w.document.querySelector('[aria-label="Reading passage"]'));
await finish("test"); assert.match(text(), /CSAT benchmark/);
await click("Back to question bank"); await papers();

await click("Start 2020 CSAT test", true);
assert.equal(saved().prelims.session.questionIds.length, 80);
assert.ok(w.document.querySelector('[aria-label="Reading passage"]'));
await click("Go to question 18", true);
assert.deepEqual([...w.document.querySelectorAll(".prelims-text thead th")].map(el => el.textContent), ["Group", "Average marks in English", "Average marks in Hindi"]);
await choose("a"); await finish("test");
assert.equal(saved().prelims.reports.length, 4);
await click("Back to question bank"); await click("History");
assert.equal([...w.document.querySelectorAll("button")].filter(b => b.textContent === "Open report").length, 4);
assert.equal(errors.length, 0, errors.join("\n"));
w.close();
console.log("CSE paper UI checks passed: 4 paper launches, practice feedback, timed tests, passage/table rendering, dropped items, bookmark/notes, refresh/resume and 4 saved reports.");
