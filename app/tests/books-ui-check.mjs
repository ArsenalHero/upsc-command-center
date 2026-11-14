import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { dateKey } from "../src/utils/date.ts";
import { createEmptyData } from "../src/data/defaults.ts";

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
      url: "https://example.test/upsc/#/books",
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
try {
  await heading("Books");
  assert.equal(current.data().books, undefined);
  assert.equal(current.w.document.querySelectorAll(".book-suggestion").length, 9);
  assert.ok(current.w.document.querySelector('a[href="#/books"]'));
  const polity = current.data().subjects.find(s => s.name.startsWith("Polity"));
  const geography = current.data().subjects.find(s => s.name === "Geography");
  await click("Add book");
  await field("Book title", "Polity UI"); await field("Book subject", polity.id);
  await field("Total book chapters", "10"); await field("Initial completed chapters", "1-4,4");
  await field("Initial revision count", "2"); await click("Save book");
  const first = current.data().books.plans[0];
  assert.equal(current.data().books.logs.length, 2);
  assert.equal(current.w.document.querySelector(".book-ring-area h2").textContent, "40% completed");
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[3].textContent, "8");
  assert.equal(current.w.document.querySelectorAll(".book-chapter-map > span").length, 10);
  assert.equal(current.w.document.querySelectorAll(".book-chapter-map .revised").length, 4);
  assert.match(current.w.document.querySelector(".book-revision-stats").textContent, /0 \/ 3full book revisions/);
  await click("Edit book Polity UI"); await field("Total book chapters", "3"); await click("Save book");
  assert.match(current.w.document.querySelector('[role="alert"]').textContent, /recorded chapters/);
  assert.equal(current.data().books.plans[0].totalChapters, 10);
  await field("Total book chapters", "12"); await click("Save book");
  assert.equal(current.data().books.plans[0].totalChapters, 12);
  assert.equal(current.data().books.logs.length, 2);
  await click("Log reading for Polity UI"); await field("Book progress chapters", "5-6"); await click("Save chapter progress");
  assert.equal(current.w.document.querySelector(".book-ring-area h2").textContent, "50% completed");
  await click("Log reading for Polity UI"); await field("Book progress chapters", "4,6"); await click("Save chapter progress");
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[1].textContent, "6");
  await click("Log revision for Polity UI"); await field("Book progress chapters", "7"); await click("Save chapter progress");
  assert.match(current.w.document.querySelector('[role="alert"]').textContent, /Record these chapters as read/);
  assert.equal(current.data().books.logs.length, 4);
  await field("Book progress chapters", "1,,2"); await click("Save chapter progress");
  assert.match(current.w.document.querySelector('[role="alert"]').textContent, /Use chapter numbers/);
  await click("Use all chapters read by this date");
  assert.equal(current.w.document.querySelector('[aria-label="Book progress chapters"]').value, "1-6");
  await click("Save chapter progress");
  assert.equal(current.data().books.logs.length, 5);
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[3].textContent, "14");
  const revision = current.data().books.logs.at(-1);
  await click(`Edit book entry ${revision.id}`); await field("Book progress chapters", "1-4"); await field("Book revision times", "3"); await click("Save chapter progress");
  assert.equal(current.data().books.logs.length, 5);
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[3].textContent, "20");
  await click(`Delete book entry ${current.data().books.logs[0].id}`); await click("Delete chapter entry");
  assert.match(current.w.document.querySelector('[role="alert"]').textContent, /related revision entries/);
  assert.equal(current.data().books.logs.length, 5); await click("Cancel");
  await click("Add suggested book Fundamentals of Physical Geography — Class XI");
  assert.equal(current.w.document.querySelector('[aria-label="Book title"]').value, "Fundamentals of Physical Geography — Class XI");
  assert.equal(current.w.document.querySelector('[aria-label="Book author"]').value, "NCERT");
  assert.equal(current.w.document.querySelector('[aria-label="Book subject"]').value, geography.id);
  assert.equal(current.w.document.querySelector('[aria-label="Total book chapters"]').value, "");
  await field("Total book chapters", "14"); await field("Initial completed chapters", "1,2,3");
  const original = current.w.Storage.prototype.setItem;
  current.w.Storage.prototype.setItem = function(k,v) { if(k === key) throw new Error("Storage quota full"); return original.call(this,k,v); };
  await click("Save book"); assert.equal(current.data().books.plans.length, 1); assert.ok(current.w.document.querySelector('dialog[open]'));
  current.w.Storage.prototype.setItem = original; await click("Save book");
  assert.equal(current.data().books.plans.length, 2); assert.equal(current.data().books.logs.length, 6);
  assert.ok(current.w.document.querySelector('[aria-label="Add suggested book Fundamentals of Physical Geography — Class XI"]').disabled);
  await field("Book subject filter", geography.id);
  assert.equal(current.w.document.querySelectorAll(".book-card").length, 1);
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[1].textContent, "3");
  assert.equal(current.w.document.querySelectorAll(".book-suggestion").length, 2);
  await field("Book subject filter", "");
  const saved = current.w.localStorage.getItem(key); current = makeDOM(saved); allDOMs.push(current.dom); await heading("Books");
  assert.equal(current.data().books.logs.length, 6); assert.equal(current.data().books.plans.length, 2);
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[1].textContent, "9");
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[3].textContent, "20");
  await click("Delete book Polity UI"); await click("Delete book");
  assert.equal(current.data().books.plans.length, 1); assert.equal(current.data().books.logs.length, 1);
  assert.ok(!current.data().books.logs.some(l => l.bookId === first.id));
  assert.equal(current.w.document.querySelectorAll(".book-kpis .kpi-value")[1].textContent, "3");
  assert.deepEqual(messages, []);
  console.log("Books UI passed: ranges, initial revisions, chapter charts, safe edits, read-before-revision, suggestions, filters, reload, failed-save retry and deletion.");
} finally { for (const dom of allDOMs) dom.window.close(); }
async function option(value) {
  const el = current.w.document.querySelector(
    `input[name="pyq-option"][value="${value}"]`,
  );
  assert.ok(el && !el.disabled);
  el.click();
  await wait();
}
