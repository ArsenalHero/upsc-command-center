import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
const built = await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  loader: { ".css": "empty" },
  define: { "import.meta.env": JSON.stringify({ PROD: false }) },
  jsx: "automatic",
});
const consoleMessages = [];
const console = new VirtualConsole();
console.on("jsdomError", (e) => {
  if (!String(e).includes("navigation")) consoleMessages.push(String(e));
});
const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  {
    url: "https://example.test/upsc/#/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  },
);
const w = dom.window;
w.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
w.scrollTo = () => {};
w.structuredClone = globalThis.structuredClone;
w.fetch = async () => ({ ok: true, json: async () => ({ url: "", publishableKey: "" }) });
w.ResizeObserver = class {
  constructor(fn) {
    this.fn = fn;
  }
  observe(el) {
    this.fn([{ target: el, contentRect: { width: 640, height: 260 } }]);
  }
  unobserve() {}
  disconnect() {}
};
w.HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    x: 0,
    y: 0,
    width: 640,
    height: 260,
    top: 0,
    left: 0,
    right: 640,
    bottom: 260,
    toJSON() {
      return this;
    },
  };
};
w.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
w.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
w.eval(built.outputFiles[0].text);
const wait = () => new Promise((r) => setTimeout(r, 80));
const until = async (predicate, message) => {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await wait();
  }
  assert.ok(predicate(), message);
};
const text = () => w.document.body.textContent;
const clickText = (value) => {
  const el = [...w.document.querySelectorAll("button")].find(
    (e) => e.textContent.trim() === value,
  );
  assert.ok(
    el,
    `Missing button: ${value}; current page: ${w.document.querySelector("h1")?.textContent}; text: ${text().slice(-1400)}`,
  );
  el.click();
};
await until(() => w.document.querySelector("h1")?.textContent === "Welcome back.", "Login page did not open");
assert.match(text(), /Accounts are being set up/);
assert.equal(w.document.querySelector('button[type="submit"]').closest("fieldset").disabled, true);
w.location.hash = "/signup";
await until(() => w.document.querySelector("h1")?.textContent === "Start your journey.", "Signup page did not open");
assert.ok(w.document.querySelector('input[autocomplete="new-password"]'));
w.location.hash = "/forgot-password";
await until(() => w.document.querySelector("h1")?.textContent === "Forgot your password?", "Password recovery page did not open");
clickText("Continue as guest");
await until(() => text().includes("Set up your preparation workspace"), "Guest setup did not open");
assert.match(text(), /Set up your preparation workspace/);
clickText("Skip setup");
await wait();
assert.match(text(), /No study data yet/);
assert.equal(
  JSON.parse(w.localStorage.getItem("upsc-command-center:v1")).settings
    .setupCompleted,
  true,
);
clickText("Explore with demo data");
await wait();
assert.match(text(), /Demo mode/);
assert.match(text(), /Your next focus/i);
const saved = w.localStorage.getItem("upsc-command-center:v1");
assert.ok(JSON.parse(saved).sessions.length > 400);
const routes = [
  "daily-study",
  "lectures",
  "syllabus",
  "prelims",
  "mains",
  "optional",
  "csat",
  "current-affairs",
  "answer-writing",
  "essay",
  "mcq-analysis",
  "pyqs",
  "tests",
  "revision",
  "weak-areas",
  "goals",
  "reports",
  "resources",
  "settings",
];
const headings = [
  "Daily study",
  "Lectures",
  "Syllabus tracker",
  "Prelims preparation",
  "Mains preparation",
  "Sociology preparation",
  "CSAT preparation",
  "Current affairs",
  "Answer writing",
  "Essay practice",
  "MCQ analysis",
  "PYQ question bank",
  "Test series",
  "Revision planner",
  "Weak areas & knowledge health",
  "Goals & progress",
  "Preparation reports",
  "Resources & custom categories",
  "Preparation settings",
];
const navigate = async (route, title) => {
  w.location.hash = "/" + route;
  await until(
    () => w.document.querySelector("h1")?.textContent === title,
    `Route ${route} did not render; got ${w.document.querySelector("h1")?.textContent}`,
  );
};
for (let i = 0; i < routes.length; i++) {
  await navigate(routes[i], headings[i]);
  assert.doesNotMatch(text(), /We couldn't open this view/, routes[i]);
}
// Reports render each period, including rolling quarterly comparisons.
await navigate("reports", "Preparation reports");
for (const period of ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]) {
  clickText(period);
  await wait();
  assert.doesNotMatch(text(), /We couldn't open this view/);
}
// Data entered in the actual UI persists through the same repository as imported/demo records.
await navigate("daily-study", "Daily study");
clickText("Add study session");
await wait();
assert.match(text(), /Add Study Session/);
clickText("60m");
await wait();
clickText("Save session");
await wait();
assert.equal(
  JSON.parse(w.localStorage.getItem("upsc-command-center:v1")).sessions.length,
  JSON.parse(saved).sessions.length + 1,
);
// Quick logging and optional details must persist through the real editor.
const latestData = () => JSON.parse(w.localStorage.getItem("upsc-command-center:v1"));
const input = name => w.document.querySelector(`dialog [name="${name}"]`);
const setInput = async (name, value) => {
  const el = input(name); assert.ok(el, `Missing field: ${name}`);
  const proto = el.tagName === "SELECT" ? w.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(value));
  el.dispatchEvent(new w.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); await wait();
};
const openSection = async id => { const b = w.document.querySelector(`[aria-controls="${id}"]`); if (b.getAttribute("aria-expanded") !== "true") { b.click(); await wait(); } };
let quick = latestData().sessions.at(-1);
assert.equal(quick.actualMinutes, 60); assert.equal(quick.plannedMinutes, 0);
assert.equal(quick.stage, latestData().subjects.find(s => s.id === quick.subjectId).stage);
assert.equal(quick.paper, latestData().subjects.find(s => s.id === quick.subjectId).paper);
clickText("Add study session"); await wait();
assert.equal(input("actualMinutes").value, "");
assert.equal(w.document.querySelectorAll(".study-extra-content:not([hidden])").length, 0);
assert.equal(input("subjectId").value, quick.subjectId);
clickText("Yesterday"); await wait(); const chosenDate = input("date").value;
w.document.querySelector(".study-recent-chip").click(); await wait();
assert.equal(input("date").value, chosenDate); assert.equal(input("actualMinutes").value, "");
clickText("PYQ practice"); await wait();
assert.equal(w.document.querySelector('[aria-controls="study-results"]').getAttribute("aria-expanded"), "true");
await setInput("questionsAttempted", 10); await setInput("correct", 7);
assert.match(w.document.querySelector(".study-result-summary").textContent, /3 incorrect.*70% accuracy/);
assert.equal(input("pyqs").value, "10");
await openSection("study-planning"); clickText("+3 days"); await wait();
assert.equal(w.document.querySelector('dialog button[type="submit"]').disabled, true);
await setInput("topicId", [...input("topicId").options].find(o => o.value).value);
assert.equal(w.document.querySelector('dialog button[type="submit"]').disabled, false);
const reminderDate = input("nextRevisionDate").value;
clickText("25m"); await wait(); clickText("Save session"); await wait();
const pyq = latestData().sessions.at(-1);
assert.equal(pyq.actualMinutes, 25); assert.equal(pyq.questionsAttempted, 10);
assert.equal(pyq.correct, 7); assert.equal(pyq.incorrect, 3); assert.equal(pyq.pyqs, 10);
assert.equal(latestData().mcqs.find(m => m.studySessionId === pyq.id).attempted, 10);
assert.equal(latestData().revisions.find(r => r.id === pyq.id + "-revision").dueDate, reminderDate);
clickText("Add study session"); await wait(); w.document.querySelector(".study-recent-chip").click(); await wait();
assert.equal(input("actualMinutes").value, ""); assert.equal(input("questionsAttempted").value, "0"); assert.equal(input("correct").value, "0"); assert.equal(input("pyqs").value, "0");
const secondSubject = [...input("subjectId").options].find(o => o.value && o.value !== quick.subjectId);
await setInput("subjectId", secondSubject.value); assert.equal(input("topicId").value, ""); assert.equal(input("resourceId").value, "");
assert.equal(input("paper").value, latestData().subjects.find(s => s.id === secondSubject.value).paper);
clickText("Cancel"); await wait();
w.document.querySelector(".timeline-row").click(); await wait(); await openSection("study-planning");
await setInput("startTime", "23:30"); await setInput("endTime", "00:15"); assert.equal(input("actualMinutes").value, "45");
clickText("90m"); await wait(); assert.equal(input("startTime").value, ""); assert.equal(input("endTime").value, "");
await openSection("study-reflection"); await setInput("focus", 8); await setInput("notes", "Revise this with a short recall test.");
const countBeforeEdit = latestData().sessions.length;
clickText("Save changes"); await wait(); assert.equal(latestData().sessions.length, countBeforeEdit);
w.document.querySelector(".timeline-row").click(); await wait(); assert.equal(input("focus").value, "8"); assert.equal(input("notes").value, "Revise this with a short recall test.");
clickText("Save changes"); await wait();

// A refresh-equivalent second DOM starts with saved data, not onboarding.
const restored = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  {
    url: "https://example.test/upsc/#/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  },
);
const rw = restored.window;
rw.localStorage.setItem(
  "upsc-command-center:v1",
  w.localStorage.getItem("upsc-command-center:v1"),
);
rw.matchMedia = w.matchMedia;
rw.scrollTo = () => {};
rw.structuredClone = globalThis.structuredClone;
rw.fetch = w.fetch;
rw.ResizeObserver = w.ResizeObserver;
rw.HTMLElement.prototype.getBoundingClientRect =
  w.HTMLElement.prototype.getBoundingClientRect;
rw.HTMLDialogElement.prototype.showModal =
  w.HTMLDialogElement.prototype.showModal;
rw.eval(built.outputFiles[0].text);
await until(
  () =>
    rw.document.querySelector("h1")?.textContent ===
    "UPSC PREPARATION COMMAND CENTER",
  "Restored dashboard did not finish rendering",
);
assert.doesNotMatch(
  rw.document.body.textContent,
  /Set up your preparation workspace/,
);
assert.match(rw.document.body.textContent, /Demo mode/);
assert.equal(consoleMessages.length, 0, consoleMessages.join("\n"));
globalThis.console.log(
  "Rendered UI checks passed: setup, empty state, demo, 20 routes, all report periods, quick study logging, PYQ results, revision reminders, recent context, overnight duration, editing, and refresh restoration. Responsive geometry and browser screenshots are not simulated by this test.",
);
dom.window.close();
restored.window.close();
