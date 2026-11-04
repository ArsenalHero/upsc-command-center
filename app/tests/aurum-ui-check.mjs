import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fixtureLicense, prepareMockDatabase, setMockUser } from "./mock-license-fixture.ts";
import { aurumPYQs } from "../src/utils/aurum.ts";

const db = new PGlite(), owner = "11111111-1111-4111-8111-111111111111";
const options = { a: "The correct choice", b: "Second choice", c: "Third choice", d: "Fourth choice" };
const questions = ["Polity", "Economy", "Polity", "Economy"].map((subject, n) => ({
  id: `pyq-${n}`, question: `Previous year question ${n}: which choice follows?`, subject, topic: "Foundations", options,
  answer: "a", keyStatus: "official", stage: "Prelims", number: n + 1, year: 2025, paper: "GS-I", sourceUrl: "https://upsc.gov.in",
  explanation: { justification: "The first option is correct based on the premise.", concept: "A tested concept", references: [] },
}));
const built = await build({
  stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";import Aurum from "./src/pages/Aurum";createRoot(document.getElementById("root")).render(<Aurum api={globalThis.aurumAPI}/>);', loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", loader: { ".css": "empty" },
  plugins: [{ name: "fixture-reviewed-bank", setup(b) {
    b.onResolve({ filter: /data\/aurumBank$/ }, () => ({ path: "bank", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const loadAurumPYQs=async()=>globalThis.aurumBank;" }));
  } }],
});
const errors = [], starts = [];
let dom, w, failAnswer = false;
const rpc = async (op, p = {}) => (await db.query("select public.mock_lab($1,$2::jsonb) data", [op, JSON.stringify(p)])).rows[0].data;
const wait = () => new Promise(r => setTimeout(r, 35));
const until = async (fn, label) => { for (let i = 0; i < 150; i++) { if (fn()) return; await wait(); } assert.ok(fn(), `${label}: ${w.document.body.textContent.slice(-700)}`); };
const click = async text => { const b = [...w.document.querySelectorAll("button")].find(e => e.textContent.trim() === text); assert.ok(b, `Missing ${text}`); assert.equal(b.disabled, false, `${text} disabled`); b.click(); await wait(); };
const field = async (selector, value) => { const input = w.document.querySelector(selector); assert.ok(input, selector); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(); };
const subjects = async () => { for (const input of w.document.querySelectorAll('.aurum-subject-grid input')) if (!input.checked) { input.click(); await wait(); } };
const source = async value => { w.document.querySelector(`[name="aurum-source"][value="${value}"]`).click(); await wait(); };
const mount = async () => {
  dom?.window.close();
  const vc = new VirtualConsole(); vc.on("jsdomError", e => errors.push(String(e)));
  dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/#/tests/prelims/aurum", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc }); w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.aurumBank = await aurumPYQs(questions);
  w.aurumAPI = async (op, p = {}) => {
    if (op === "aurum-answer" && failAnswer) { failAnswer = false; throw Error("Connection test unavailable. Try again."); }
    const data = await rpc(op, p); if (op === "aurum-start") starts.push(data); return data;
  };
  w.eval(built.outputFiles[0].text);
  await until(() => w.document.querySelector(".aurum-builder"), "Builder did not load");
};
try {
  await prepareMockDatabase(db, [{ id: owner, admin: true }]);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261104031926_aurum_subject_practice.sql", import.meta.url), "utf8"));
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
  await click("Build another set");
  await until(() => w.document.querySelector(".aurum-builder"), "Builder did not return");
  await subjects(); await source("both"); await field("#aurum-count", "2"); await click("Start practice");
  await until(() => starts.length === 2, "Second set absent");
  const prior = new Set((await rpc("aurum-session", { sessionId: starts[0].id })).questions.map(q => q.fingerprint));
  for (const q of starts[1].questions) assert.equal(prior.has(q.fingerprint), false, "A question repeated in a later set");
  await click("Finish this set");
  await until(() => w.document.querySelector('dialog[open]'), "Finish confirmation absent");
  assert.match(w.document.querySelector("dialog").textContent, /2 unanswered questions/);
  await click("Finish set");
  await until(() => w.document.querySelector(".aurum-complete"), "Finish did not save");
  assert.equal((await rpc("aurum-state")).practised, 4);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("Aurum UI passed: subjects, all sources, count validation, answer secrecy, retry, reload/resume, completion and no repeats.");
} finally { dom?.window.close(); await db.close(); }
