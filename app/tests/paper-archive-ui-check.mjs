import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { archivedPapers, archivedPaperQuestions, newPaperAttempt } from "../src/utils/paperArchive.ts";

const built = await build({
  stdin: { contents: `import React from "react"; import {createRoot} from "react-dom/client"; import PaperArchive from "./src/components/PaperArchive"; import {ReviewedExplanationText} from "./src/components/ReviewedExplanation"; createRoot(document.getElementById("root")).render(<PaperArchive timed={false} renderExplanation={q => <section aria-label="Answer and explanation"><h3>{q.keyStatus === "dropped" ? "Dropped by UPSC" : "Official answer: " + q.answer?.toUpperCase().split("").join(" or ")}</h3><ReviewedExplanationText explanation={q.explanation} /></section>} />);`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", jsx: "automatic", loader: { ".css": "empty" },
});
const errors = [], vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(String(e)));
const pause = () => new Promise(r => setTimeout(r, 15));
function mount(saved) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://example.test/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  if (saved) dom.window.localStorage.setItem("upsc-cse-paper-archive:v1:guest", JSON.stringify(saved));
  dom.window.eval(built.outputFiles[0].text);
  return dom;
}
let dom = mount();
const doc = () => dom.window.document;
const body = () => doc().body.textContent;
async function click(label, scope = doc()) {
  const b = [...scope.querySelectorAll("button")].find(b => b.textContent.trim() === label || b.getAttribute("aria-label") === label);
  assert.ok(b && !b.disabled, `Missing enabled button: ${label}`);
  b.click(); await pause();
}
async function select(option) {
  const input = doc().querySelector(`input[name="archive-paper-choice"][value="${option}"]`);
  assert.ok(input && !input.disabled); input.click(); await pause();
}
function card(p) { return [...doc().querySelectorAll(".paper-year")].find(s => s.getAttribute("aria-label").startsWith(String(p.year))).querySelectorAll(".paper-archive-card")[p.paper === "gs" ? 0 : 1]; }
await pause();
for (const p of archivedPapers) {
  const q = archivedPaperQuestions(p)[0];
  await click("Practise paper", card(p));
  assert.equal(doc().querySelectorAll("input[name=archive-paper-choice]").length, 4);
  assert.equal(doc().querySelectorAll("object[type='application/pdf']").length, 0);
  assert.ok(body().includes(q.options[p.answers[0].toLowerCase()]));
  assert.equal(doc().querySelector('[aria-label="Answer and explanation"]'), null);
  assert.equal(doc().querySelectorAll(".prelims-passage").length, p.paper === "csat" ? 1 : 0);
  await select(p.answers[0]); await click("Submit answer");
  assert.match(body(), /Right · Official answer:/);
  assert.ok(body().includes(q.explanation.justification));
  assert.ok([...doc().querySelectorAll("input[name=archive-paper-choice]")].every(x => x.disabled));
  await click("Next question →");
  assert.ok(doc().querySelector('[aria-label="Question 2 text"]'));
  await click("← Save & return to full papers");
}
// Existing saved answers still select the original option in the new text reader.
const saved = JSON.parse(dom.window.localStorage.getItem("upsc-cse-paper-archive:v1:guest"));
dom.window.close(); dom = mount(saved); await pause();
await click("Resume practice", card(archivedPapers[0]));
await click("← Previous question");
assert.equal(doc().querySelector('input[value="D"]').checked, true);
assert.ok(doc().querySelector('[aria-label="Answer and explanation"]'));
await click("Study all 100 explanations");
assert.equal(doc().querySelectorAll(".paper-study-note").length, 100);
const search = doc().querySelector('input[type="search"]');
Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(search, "Kikori");
search.dispatchEvent(new dom.window.Event("input", { bubbles: true })); await pause();
assert.equal(doc().querySelectorAll(".paper-study-note").length, 1);
await click("← Back to paper"); await click("← Save & return to full papers");
// Test mode hides every explanation until the paper is submitted.
dom.window.close(); dom = mount(); await pause();
await click("Start test", card(archivedPapers[1]));
await select("B");
assert.equal(doc().querySelector('[aria-label="Answer and explanation"]'), null);
assert.equal([...doc().querySelectorAll("button")].some(b => b.textContent === "Study all 80 explanations"), false);
await click("Finish & view report"); await click("Submit paper");
assert.ok(doc().querySelector('[aria-label="Paper score"]'));
assert.ok(doc().querySelector('[aria-label="Answer and explanation"]'));
await click("Question 54, unanswered"); assert.match(body(), /32⁵ \+ 2²⁷/);
await click("Study all 80 explanations"); assert.equal(doc().querySelectorAll(".paper-study-note").length, 80);
dom.window.close();
// Multiple accepted answers and dropped questions retain their grading behaviour.
for (const [p, n, answer, expected] of [[archivedPapers[7], 9, "D", /Right · Official answer: C or D/], [archivedPapers[0], 20, "A", /Dropped by UPSC · excluded from scoring/]]) {
  const run = newPaperAttempt(p, "practice", false); run.current = n;
  dom = mount([run]); await pause(); await click("Resume practice", card(p));
  await select(answer); await click("Submit answer"); assert.match(body(), expected); dom.window.close();
}
assert.deepEqual(errors, []);
console.log("Paper archive UI passed: all eight text papers, choices, full passages, explanations, answer locking, saved progress, search, test submission and final-key exceptions.");
