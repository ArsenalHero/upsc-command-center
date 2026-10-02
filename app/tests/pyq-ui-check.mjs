import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyData } from "../src/data/defaults.ts";

const bank = JSON.parse(
  readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"),
);
const q1 = bank.find((q) => q.year === 2024 && q.number === 1);
const q2 = bank.find((q) => q.year === 2024 && q.number === 2);
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
  await heading("Previous year questions");
  assert.match(text(), /220 questions ready/);
  await click("Yearwise");
  await field("PYQ year", "2024");
  await field("PYQ stage", "Prelims");
  assert.equal(
    current.w.document.querySelector(".section-heading h2").textContent,
    "100 questions",
  );
  await click("Practise filtered questions");
  await heading("2024 · Prelims GS-I");
  assert.match(text(), /Pause timer/);
  assert.ok(
    current.w.document
      .querySelector("svg image")
      .getAttribute("href")
      .startsWith("./pyq/2024-"),
  );
  current.advance(20);
  await option(q1.answer === "a" ? "b" : "a");
  await field("Question confidence", "2");
  await field("Question mistake category", "Conceptual");
  await field("Question notes", "Revisit terrestrial radiation");
  current.visibility(true);
  await wait();
  assert.equal(current.data().pyqDraft.seconds, 20);
  current.advance(300);
  current.visibility(false);
  await click("Resume timer");
  current.advance(5);
  await click("Submit answer");
  assert.equal(current.data().pyqs.length, 1);
  const wrong = current.data().pyqs[0];
  assert.equal(wrong.attempt.outcome, "incorrect");
  assert.equal(wrong.attempt.seconds, 25);
  assert.equal(wrong.attempt.confidence, 2);
  assert.equal(wrong.revisionNeeded, true);
  assert.equal(current.data().pyqDraft.index, 1);
  await field("Question notes", "Updated after checking the official key");
  await click("Save review notes");
  assert.equal(
    current.data().pyqs[0].attempt.notes,
    "Updated after checking the official key",
  );
  await click("Next question");
  assert.match(text(), /Original Q2/);
  assert.equal(
    current.w.document.querySelector('input[name="pyq-option"]:checked'),
    null,
  );
  current.advance(12);
  await option(q2.answer);
  await click("Save & exit");
  await heading("Previous year questions");
  const saved = current.w.localStorage.getItem(key);
  assert.equal(current.data().pyqDraft.index, 1);
  assert.equal(current.data().pyqDraft.seconds, 12);
  assert.equal(current.data().pyqDraft.selectedOption, q2.answer);

  current = makeDOM(saved);
  allDOMs.push(current.dom);
  await heading("Previous year questions");
  await click("Resume practice");
  await heading("2024 · Prelims GS-I");
  assert.match(text(), /Original Q2/);
  assert.equal(
    current.w.document.querySelector('input[name="pyq-option"]:checked').value,
    q2.answer,
  );
  assert.equal(
    current.w.document.querySelector('[aria-label="Question active time"]')
      .textContent,
    "00:12",
  );
  current.advance(600);
  await click("Submit answer");
  assert.equal(current.data().pyqs[1].attempt.seconds, 12);
  assert.equal(current.data().pyqs[1].attempt.outcome, "correct");
  await click("Next question");
  current.advance(8);
  await click("Skip & save time");
  assert.equal(current.data().pyqs[2].attempt.outcome, "skipped");
  assert.equal(current.data().pyqs[2].attempt.seconds, 8);
  await click("Save & exit");
  await heading("Previous year questions");
  assert.equal(
    current.data().pyqDraft.index,
    3,
    "Exiting the result must not overwrite the saved next position",
  );
  await field("PYQ year", "2024");
  await field("PYQ status", "incorrect");
  assert.equal(
    current.w.document.querySelector(".section-heading h2").textContent,
    "1 questions",
  );
  await click("Reattempt wrong questions");
  await option(q1.answer);
  await click("Submit answer");
  await click("Finish practice");
  await heading("Practice complete");
  assert.equal(current.data().pyqs.length, 4);
  assert.equal(
    current.data().pyqs.filter((p) => p.attempt.questionId === q1.id).length,
    2,
  );
  await click("Back to question bank");
  await click("Reset filters");
  await click("History");
  assert.equal(
    current.w.document.querySelectorAll(".pyq-history-row").length,
    4,
  );

  await click("Subjectwise");
  await field("PYQ subject", "Economy");
  assert.ok(current.w.document.querySelectorAll(".pyq-bank-row").length);
  assert.ok(
    [...current.w.document.querySelectorAll(".pyq-bank-row")].every((row) =>
      row.textContent.includes("Economy"),
    ),
  );
  await click("Reset filters");
  await field("PYQ year", "2025");
  await field("PYQ stage", "Prelims");
  await click("Practise 2025 Prelims GS-I question 1");
  await option("a");
  await click("Submit answer");
  assert.equal(current.data().pyqs.at(-1).attempt.outcome, "ungraded");
  assert.equal(current.data().pyqs.at(-1).attempt.grading, "none");
  await click("Finish practice");
  await click("Back to question bank");
  await field("PYQ stage", "Mains");
  await click("Practise 2025 GS-II question 1");
  await field("Mains PYQ answer", "My answer about the governance issue.");
  await field("Mains self-assessed marks", "6.5");
  current.advance(45);
  await click("Save answer");
  assert.equal(current.data().pyqs.at(-1).attempt.outcome, "written");
  assert.equal(current.data().pyqs.at(-1).attempt.selfScore, 6.5);
  assert.equal(current.data().pyqs.at(-1).attempt.seconds, 45);
  assert.equal(
    current.data().mcqs.length,
    0,
    "Practice should not write duplicate MCQ entries",
  );
  assert.equal(messages.length, 0, messages.join("\n"));
  console.log(
    "PYQ UI checks passed: subject/year filters, real-paper images, hidden-tab timer, official marking, notes, draft reload, skipped time, repeats, unmarked keys and Mains answers.",
  );
} finally {
  allDOMs.forEach((dom) => dom.window.close());
}
