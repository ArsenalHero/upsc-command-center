import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture.ts";
import { aurumPYQs } from "../src/utils/aurum.ts";
import { aurumSubjects } from "../src/utils/aurum.ts";

const db = new PGlite(), owner = "11111111-1111-4111-8111-111111111111";
const options = { a: "The correct choice", b: "Second choice", c: "Third choice", d: "Fourth choice" };
const questions = ["Polity", "Economy", "Polity", "Economy"].map((subject, n) => ({
  id: `pyq-${n}`, question: `Previous year question ${n}: which choice follows?`, subject, topic: "Foundations", options,
  answer: "a", keyStatus: "official", stage: "Prelims", number: n + 1, year: 2025, paper: "GS-I", sourceUrl: "https://upsc.gov.in",
  explanation: { justification: "The first option is correct based on the premise.", concept: "A tested concept", references: [] },
}));
const built = await build({
  stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";import {HashRouter} from "react-router-dom";import Aurum from "./src/pages/Aurum";createRoot(document.getElementById("root")).render(<HashRouter><Aurum api={globalThis.aurumAPI}/></HashRouter>);', loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", loader: { ".css": "empty" },
});
assert.equal(built.outputFiles[0].text.includes("loadAurumPYQs"), false, "The rendered setup must not import the full PYQ bank");
const errors = [], starts = [], calls = [];
let dom, w, failAnswer = false, delayNextCatalog = false;
const rpc = async (op, p = {}) => (await db.query("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
const wait = () => new Promise(r => setTimeout(r, 35));
const until = async (fn, label) => { for (let i = 0; i < 150; i++) { if (fn()) return; await wait(); } assert.ok(fn(), `${label}: ${w.document.body.textContent.slice(-700)}`); };
const click = async text => { const b = [...w.document.querySelectorAll("button")].find(e => e.textContent.trim() === text); assert.ok(b, `Missing ${text}`); assert.equal(b.disabled, false, `${text} disabled`); b.click(); await wait(); };
const field = async (selector, value) => { const input = w.document.querySelector(selector); assert.ok(input, selector); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(); };
const ready = async () => until(() => w.document.querySelector('.aurum-available')?.getAttribute('aria-busy') === 'false', "Counts did not settle");
const subjects = async () => { for (const input of w.document.querySelectorAll('.aurum-subject-grid input')) if (!input.checked) { input.click(); await wait(); } await ready(); };
const source = async value => { w.document.querySelector(`[name="aurum-source"][value="${value}"]`).click(); await wait(); await ready(); };
const mount = async (path = "/tests/prelims/aurum") => {
  dom?.window.close();
  const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e)));
  dom = new JSDOM('<div id="root"></div>', { url: `https://example.test/#${path}`, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc }); w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const style = w.document.createElement('style');
  style.textContent = 'label{display:flex;flex-direction:column}' + readFileSync(new URL('../src/aurum.css', import.meta.url), 'utf8');
  w.document.head.appendChild(style);
  w.aurumAPI = async (op, p = {}) => {
    calls.push({ op, p });
    if (op === 'aurum-catalog' && calls.length === 1) await new Promise(r => setTimeout(r, 300));
    if (op === 'aurum-catalog' && delayNextCatalog) { delayNextCatalog = false; await new Promise(r => setTimeout(r, 350)); }
    if (op === "aurum-answer" && failAnswer) { failAnswer = false; throw Error("Connection test unavailable. Try again."); }
    const data = await rpc(op, p); if (op === "aurum-start-v2") starts.push(data); return data;
  };
  w.eval(built.outputFiles[0].text);
  if (path !== "/tests/prelims/aurum") { await until(() => w.document.querySelector(".aurum-insights"), "Saved practice view did not load"); return; }
  await until(() => w.document.querySelector(".aurum-builder"), "Builder did not load");
  assert.equal(w.document.querySelectorAll('[name="aurum-source"]').length, 3, "Source controls render before catalogue data arrives");
  await until(() => w.document.querySelector('.aurum-subject-grid input'), "Subjects did not load");
  await ready();
  assert.deepEqual([...w.document.querySelectorAll('.aurum-subject-grid label > span')].map(s=>s.textContent),[...aurumSubjects]);
  assert.equal(w.getComputedStyle(w.document.querySelector('.aurum-source-grid label')).flexDirection, 'row', 'Global stacked-label styles must not stack source cards');
  assert.equal(w.getComputedStyle(w.document.querySelector('.aurum-subject-grid label')).display, 'grid', 'Subjects use compact horizontal rows');
};
try {
  await prepareMockDatabase(db, [{ id: owner, admin: true }]);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261104031926_aurum_subject_practice.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261104045009_aurum_fast_setup.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261104060906_aurum_subject_choices.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261104165754_aurum_analysis_review.sql", import.meta.url), "utf8"));
  for (const q of await aurumPYQs(questions)) await db.query(`insert into mock_private.aurum_question_index(origin,source_id,fingerprint,subject,subjects,question)
    values('pyq',$1,$2,$3,$4,$5::jsonb)`, [q.sourceId,q.fingerprint,q.subject,q.subjects,JSON.stringify(q.question)]);
  await setMockUser(db, owner); await rpc("verify-license", { licenseKey: fixtureLicense });
  await rpc("admin-test", { code: "AURUM-UI", name: "UI source mock", year: 2027, series: "Validation", paper: "GS-I", kind: "Sectional", duration: 30, positive: 2, negative: .5, status: "active",
    questions: ["Polity", "Economy", "Economy"].map((subject, n) => ({ question: `Mock practice question ${n}: which statement follows?`, subject, topic: "Foundations", options, correct: "a", explanation: "The first option is correct from the premise." })) });
  await mount();
  assert.equal([...w.document.querySelectorAll("button")].find(b => b.textContent.trim() === "Start practice").disabled, true);
  await subjects();
  assert.equal(w.document.querySelector(".aurum-available strong").textContent, "7");
  await field("#aurum-count", "1.5");
  assert.match(w.document.querySelector(".aurum-set-summary").textContent, /whole number/);
  await field("#aurum-count", "8");
  assert.match(w.document.querySelector(".aurum-set-summary").textContent, /Only 7 fresh/);
  await source("pyq");
  assert.equal(w.document.querySelector(".aurum-available strong").textContent, "4");
  await source("mock");
  assert.equal(w.document.querySelector(".aurum-available strong").textContent, "3");
  await source("both"); await field("#aurum-count", "2"); await click("Start practice");
  await until(() => w.document.querySelector(".aurum-question"), "Practice did not start");
  assert.equal(new Set(starts[0].questions.map(q => q.origin)).size, 2);
  assert.equal(Object.hasOwn(calls.find(c => c.op === 'aurum-start-v2').p, 'questions'), false, 'Only the requested filters/count are sent when starting');
  assert.equal(calls.some(c => c.op === 'aurum-state'), false, 'Setup must not request the large legacy pool');
  assert.equal(calls.some(c => ['aurum-analysis', 'aurum-history', 'aurum-review'].includes(c.op)), false, 'Reports must not delay practice setup');
  assert.equal(w.document.querySelector(".aurum-feedback"), null);
  w.document.querySelector('.aurum-options input[value="a"]').click(); await wait();
  failAnswer = true; await click("Check answer");
  assert.match(w.document.querySelector('[role="alert"]').textContent, /Connection test/);
  assert.equal(w.document.querySelector('.aurum-options input[value="a"]').checked, true);
  await click("Check answer");
  await until(() => w.document.querySelector(".aurum-feedback.correct"), "Answer did not save");
  await click("Save & leave");
  await until(() => w.document.querySelector(".aurum-resume"), "Resume shortcut absent");
  await mount(); // Full React/DOM reload; only the database persists.
  await click("Resume practice");
  await until(() => w.document.querySelector(".aurum-question h3")?.textContent.includes("2 of 2"), "Reload did not resume at next unanswered question");
  await click("Skip question");
  await until(() => w.document.querySelector(".aurum-complete"), "Session did not complete");
  assert.match(w.document.querySelector(".aurum-score").textContent, /1correct0incorrect1skipped/);
  assert.match(w.document.querySelector('.aurum-outcome-ring svg').getAttribute('aria-label'), /1 correct, 0 wrong, 1 skipped/);
  assert.equal(w.document.querySelector('.aurum-outcome-ring strong').textContent, '100%');
  await click("Build another set");
  await until(() => w.document.querySelector(".aurum-builder"), "Builder did not return");
  await subjects(); await source("both"); await field("#aurum-count", "2"); await click("Start practice");
  await until(() => starts.length === 2, "Second set absent");
  const prior = new Set((await rpc("aurum-session", { sessionId: starts[0].id })).questions.map(q => q.fingerprint));
  for (const q of starts[1].questions) assert.equal(prior.has(q.fingerprint), false, "A question repeated in a later set");
  w.document.querySelector('.aurum-options input[value="b"]').click(); await wait(); await click("Check answer");
  await until(() => w.document.querySelector('.aurum-feedback.incorrect'), "Wrong answer did not save");
  await click("Finish this set");
  await until(() => w.document.querySelector('dialog[open]'), "Finish confirmation absent");
  assert.match(w.document.querySelector("dialog").textContent, /1 unanswered questions/);
  await click("Finish set");
  await until(() => w.document.querySelector(".aurum-complete"), "Finish did not save");
  await click("Flag question");
  await until(() => w.document.querySelector('.aurum-flag-btn')?.getAttribute('aria-pressed') === 'true', "Post-practice flag did not save");
  const wrongFilter = [...w.document.querySelectorAll('.aurum-review-filter-bar button')].find(b => b.textContent.startsWith('Wrong'));
  wrongFilter.click(); await wait();
  assert.equal(w.document.querySelectorAll('.aurum-palette [role="group"] button').length, 1, 'Completed review navigates only the requested outcome');
  assert.match(w.document.querySelector('.aurum-feedback').className, /incorrect/);
  assert.equal((await rpc("aurum-state")).practised, 4);
  await click("Build another set"); await ready();
  await click("Clear"); await ready();
  delayNextCatalog = true;
  const inputs = [...w.document.querySelectorAll('.aurum-subject-grid input')];
  inputs[0].click(); await new Promise(r => setTimeout(r, 150));
  inputs[1].click(); await wait(); await ready();
  const currentAvailable = w.document.querySelector('.aurum-available strong').textContent;
  await new Promise(r => setTimeout(r, 450));
  assert.equal(w.document.querySelector('.aurum-available strong').textContent, currentAvailable, 'A slower response for an older selection must not overwrite the current counts');
  assert.equal(w.document.querySelector('.aurum-available').getAttribute('aria-busy'), 'false');
  const ledgerBeforeReview = (await rpc('aurum-state')).practised;
  w.location.hash = '/tests/prelims/aurum/analysis';
  await until(() => w.document.querySelector('.aurum-metric-grid'), 'Analysis did not load');
  assert.deepEqual([...w.document.querySelectorAll('.aurum-metric-grid strong')].map(v => v.textContent), ['4', '50%', '1', '1']);
  assert.match(w.document.querySelector('.aurum-outcome-ring svg').getAttribute('aria-label'), /1 correct, 1 wrong, 2 skipped/);
  await until(() => w.document.querySelectorAll('.aurum-set-list > article').length === 2, 'Complete set history missing');
  assert.ok(w.document.querySelector('.aurum-subject-report a'), 'Subject analysis is available');
  assert.equal(w.document.querySelectorAll('.aurum-source-report > div:last-child > a').length, 2, 'PYQ/mock breakdown available');
  w.location.hash = '/tests/prelims/aurum/review?filter=incorrect';
  await until(() => w.document.querySelector('.aurum-review-list > article'), 'Saved wrong questions absent');
  assert.equal(w.document.querySelectorAll('.aurum-review-list > article').length, 1);
  await click('Open question');
  await until(() => w.document.querySelector('.aurum-feedback.incorrect'), 'Could not revisit the saved wrong answer');
  assert.equal(w.document.querySelector('.aurum-flag-btn').getAttribute('aria-pressed'), 'true');
  assert.equal(w.document.querySelectorAll('.aurum-palette [role="group"] button').length, 1);
  await click('Back to Aurum');
  await until(() => w.document.querySelector('.aurum-review-list'), 'Back did not return to saved question review');
  const callStart = calls.length;
  await mount('/tests/prelims/aurum/review?filter=flagged'); // Another full page visit.
  await until(() => w.document.querySelector('.aurum-review-list > article'), 'Flags did not survive reload');
  assert.equal(w.document.querySelectorAll('.aurum-review-list > article').length, 1);
  assert.equal(calls.slice(callStart).some(c => c.op === 'aurum-catalog'), false, 'Direct review does not fetch the practice catalogue');
  await click('Flagged');
  await until(() => w.document.querySelector('.aurum-report-empty h3')?.textContent === 'No flagged questions here', 'Unflagged question stayed in review list');
  assert.equal((await rpc('aurum-session', { sessionId: starts[1].id })).flags.length, 0);
  assert.equal((await rpc('aurum-state')).practised, ledgerBeforeReview, 'Revisiting questions must not consume fresh questions');
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("Aurum UI passed: fast setup, validation, answer retries, resume/no repeats, result charts, persistent flags, analysis/history and saved wrong-question review.");
} finally { dom?.window.close(); await db.close(); }
