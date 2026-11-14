import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDays, dateKey } from "../src/utils/date.ts";
import { createEmptyData } from "../src/data/defaults.ts";

const bank = JSON.parse(
  readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"),
);
const q1 = bank.find((q) => q.stage === "Prelims" && q.number === 1);
const q2 = bank.find((q) => q.stage === "Prelims" && q.number === 2);
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
      url: "https://example.test/upsc/#/lectures",
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
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
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
  await heading("Lectures");
  assert.ok(current.w.document.querySelector('a[href="#/lectures"]'));
  assert.match(text(), /Your first lecture target/);
  await click("Set lecture target"); await field("Total lecture target", "10"); await field("Daily lecture target", "2"); await field("Lecture course", "Foundation lectures"); await click("Save target");
  assert.equal(current.data().lectures.plans.length, 1);
  const plan = current.data().lectures.plans[0];
  await click("Log lectures"); await field("Lectures completed", "3"); await field("Lecture minutes", "90"); await field("Lecture notes", "Ancient India"); await click("Save daily progress");
  assert.equal(current.data().lectures.logs.length, 1); assert.equal(current.data().lectures.logs[0].completed, 3);
  assert.equal(current.w.document.querySelectorAll(".lecture-kpis .kpi-value")[1].textContent, "3");
  await click("Log lectures"); assert.equal(current.w.document.querySelector('[aria-label="Lectures completed"]').value, "3"); await field("Lectures completed", "4"); await click("Save daily progress");
  assert.equal(current.data().lectures.logs.length, 1); assert.equal(current.data().lectures.logs[0].completed, 4);
  assert.match(text(), /6 remaining/);
  await click("Set lecture target"); await field("Total lecture target", "20"); await click("Save target");
  const second=current.data().lectures.plans.find(p=>p.id!==plan.id);
  await click("Log lectures"); await field("Log lecture subject", second.id); await field("Lecture completion date", addDays(dateKey(), -1)); await field("Lectures completed", "2"); await click("Save daily progress");
  assert.equal(current.data().lectures.logs.length, 2);
  assert.equal(current.w.document.querySelectorAll(".lecture-kpis .kpi-value")[1].textContent,"6");
  assert.equal(current.w.document.querySelectorAll(".lecture-heatmap button").length,28);
  assert.equal(current.w.document.querySelectorAll(".lecture-bars button").length,14);
  await field("Lecture chart period", "7"); assert.equal(current.w.document.querySelectorAll(".lecture-bars button").length,7);
  await field("Lecture subject filter", second.subjectId); assert.equal(current.w.document.querySelectorAll(".lecture-kpis .kpi-value")[1].textContent,"2"); await field("Lecture subject filter", "");
  await click("All history"); assert.equal(current.w.document.querySelectorAll(".lecture-log-row").length,2);
  const saved=current.w.localStorage.getItem(key); current=makeDOM(saved);allDOMs.push(current.dom);await heading("Lectures");
  assert.equal(current.data().lectures.logs.length,2); assert.equal(current.w.document.querySelectorAll(".lecture-kpis .kpi-value")[1].textContent,"6");
  await click("Log lectures"); await field("Lectures completed","5");
  const original=current.w.Storage.prototype.setItem;
  current.w.Storage.prototype.setItem=function(k,v){if(k===key)throw new Error("Storage quota full");return original.call(this,k,v);};
  await click("Save daily progress"); assert.equal(current.data().lectures.logs.find(l=>l.planId===plan.id).completed,4); assert.ok(current.w.document.querySelector('dialog[open]'));
  current.w.Storage.prototype.setItem=original; await click("Save daily progress");
  assert.equal(current.data().lectures.logs.length,2); assert.equal(current.data().lectures.logs.find(l=>l.planId===plan.id).completed,5);
  const subjectName=current.data().subjects.find(s=>s.id===plan.subjectId).name;
  await click(`Delete ${subjectName} log ${dateKey()}`);await click("Delete entry");
  assert.equal(current.data().lectures.logs.length,1);assert.equal(current.data().lectures.plans.length,2);
  assert.equal(current.w.document.querySelectorAll(".lecture-kpis .kpi-value")[1].textContent,"2");
  assert.deepEqual(messages,[]);
  console.log("Lecture UI passed: targets, daily totals, safe edits, subject filters, charts, reload, failed-save retry and deletion.");
} finally { for(const dom of allDOMs) dom.window.close(); }
