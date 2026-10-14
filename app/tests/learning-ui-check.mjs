import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults.ts";
import { addDays, dateKey } from "../src/utils/date.ts";

const bundled = await build({ entryPoints: ["src/main.tsx"], bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ PROD: false }) }, jsx: "automatic" });
const today = dateKey(), yesterday = addDays(today, -1), seed = createEmptyData();
seed.settings.setupCompleted = true;
const [first, second] = seed.subjects;
seed.books = {
  plans: [{ id: "book", title: "Polity handbook", author: "A reader", edition: "2026", subjectId: first.id, totalChapters: 70, revisionTarget: 2 }],
  logs: [{ id: "book-old", bookId: "book", date: yesterday, kind: "reading", chapters: [1, 2], repeats: 1, notes: "Earlier reading" }],
};
seed.lectures = {
  plans: [first, second].map((s, i) => ({ id: `plan-${i}`, subjectId: s.id, course: `Foundation ${i}`, target: 10, dailyTarget: i ? 1 : 2, dueDate: today })),
  logs: [
    { id: "lecture-old", planId: "plan-0", date: yesterday, completed: 2, minutes: 60, notes: "Earlier day" },
    { id: "lecture-today", planId: "plan-0", date: today, completed: 3, minutes: 90, notes: "Saved notes" },
    { id: "lecture-other", planId: "plan-1", date: yesterday, completed: 2, minutes: 50, notes: "Other subject" },
  ],
};
const errors = [], vc = new VirtualConsole();
vc.on("jsdomError", error => { if (!String(error).includes("navigation")) errors.push(String(error)); });
const key = "upsc-command-center:v1";
function open(saved) {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "https://example.test/upsc/#/books", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.structuredClone = structuredClone; w.scrollTo = () => {};
  w.fetch = async () => ({ ok: true, json: async () => ({ url: "", publishableKey: "" }) });
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  w.localStorage.setItem(key, saved || JSON.stringify(seed));
  w.eval(bundled.outputFiles[0].text);
  return w;
}
let w = open();
const wait = () => new Promise(resolve => setTimeout(resolve, 50));
const until = async (fn, label) => { for (let i = 0; i < 100; i++) { if (fn()) return; await wait(); } assert.ok(fn(), label); };
const stored = () => JSON.parse(w.localStorage.getItem(key));
const click = async name => {
  const el = [...w.document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === name || b.textContent.trim() === name);
  assert.ok(el && !el.disabled, `Missing enabled button ${name}`); el.focus(); el.click(); await wait();
};
const field = async (name, value) => {
  const el = w.document.querySelector(`[aria-label="${name}"]`); assert.ok(el, `Missing field ${name}`);
  const proto = el.tagName === "SELECT" ? w.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new w.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); await wait();
};
const route = async page => { w.location.hash = `/${page.toLowerCase()}`; await until(() => w.document.querySelector("h1")?.textContent === page, page); await wait(); };
await until(() => w.document.querySelector(".book-shelf"), "Books did not render");
const unrelated = JSON.stringify(stored().sessions);
await click("Log next chapter for Polity handbook");
assert.equal(w.document.querySelector('[aria-label="Book progress chapters"]').value, "3");
assert.equal(stored().books.logs.length, 1, "Opening next chapter must not save progress");
assert.equal(w.document.querySelectorAll(".chapter-picker-grid > button").length, 50);
await click("Next chapter group");
assert.ok(w.document.querySelector('[aria-label="Select chapter 51"]'));
await click("Previous chapter group");
await click("Select chapter 4");
assert.equal(w.document.querySelector('[aria-label="Book progress chapters"]').value, "3-4");
await click("Save chapter progress");
assert.deepEqual(stored().books.logs.at(-1).chapters, [3, 4]);
await click("Edit book Polity handbook");
await field("Daily book chapter goal", "3"); await field("Book reading deadline", addDays(today, 3));
await click("Save book");
assert.equal(stored().books.plans[0].dailyTarget, 3);
assert.equal(stored().books.logs[0].id, "book-old");
await click("Log reading for Polity handbook"); await click("Select next chapters");
assert.equal(w.document.querySelector('[aria-label="Book progress chapters"]').value, "5-7");
await click("Cancel");
assert.equal(stored().books.logs.length, 2);
await click("Log revision for Polity handbook");
assert.ok(w.document.querySelector('[aria-label="Select chapter 5"]').disabled);
await click("Select chapter 2");
await click("Save chapter progress");
assert.equal(stored().books.logs.at(-1).kind, "revision");
await field("Search books", "A reader");
assert.equal(w.document.querySelectorAll(".book-card").length, 1);
await field("Book status filter", "read");
assert.ok(w.document.querySelector(".learning-no-results"));
assert.match(w.document.querySelector(".book-kpis").textContent, /Books tracked1/, "Shelf filters keep overview totals unchanged");
await click("Clear shelf filters");
assert.equal(w.document.querySelectorAll(".book-card").length, 1);

await route("Lectures");
await click("Log several subjects"); await click("Use daily targets");
assert.equal(w.document.querySelector(`[aria-label="Batch total for ${first.name}"]`).value, "3", "Suggestions must not lower a saved total");
assert.equal(stored().lectures.logs.length, 3);
await click("Cancel");
await click("Log several subjects");
await click(`Add one ${first.name} lecture`);
await click("Save selected subjects");
const saved = stored().lectures.logs.find(l => l.id === "lecture-today");
assert.deepEqual(saved, { ...seed.lectures.logs[1], completed: 4 });
assert.deepEqual(stored().lectures.logs.find(l => l.id === "lecture-other"), seed.lectures.logs[2]);
assert.equal(stored().lectures.logs.length, 3);
await click("Log several subjects");
w.document.querySelector(`[aria-label="Include ${first.name} in batch"]`).click(); await wait();
await click("Save selected subjects");
assert.equal(stored().lectures.logs.length, 3, "Saving an existing total must not add another entry");
await click("Log several subjects");
await click(`Add one ${second.name} lecture`);
assert.equal(w.document.querySelector(`[aria-label="Batch total for ${second.name}"]`).value, "1", "A new +1 entry starts at one lecture");
await field(`Batch total for ${first.name}`, "0");
w.document.querySelector(`[aria-label="Include ${first.name} in batch"]`).click(); await wait();
await click("Save selected subjects");
assert.equal(stored().lectures.logs.length, 4);
assert.equal(stored().lectures.logs.find(l => l.planId === "plan-1" && l.date === today).completed, 1);
assert.equal(stored().lectures.logs.find(l => l.id === "lecture-today").completed, 4);
await click("Log several subjects");
await field("Batch lecture date", addDays(today, -2)); await click("Use daily targets");
await click("Save selected subjects");
assert.equal(stored().lectures.logs.filter(l => l.date === addDays(today, -2)).length, 2);
assert.equal(stored().lectures.logs.find(l => l.id === "lecture-today").completed, 4);
await field("Lecture status filter", "attention");
assert.ok(w.document.querySelectorAll(".lecture-subject-card").length > 0);
await field("Search lecture targets", "unknown course");
assert.ok(w.document.querySelector(".learning-no-results"));
await click("Clear target filters");
assert.equal(w.document.querySelectorAll(".lecture-subject-card").length, 2);

await click("Open themes and wallpapers");
await click("Preview Desert dawn");
assert.equal(w.document.querySelectorAll("dialog[open]").length, 2);
assert.ok(w.document.querySelector(".landscape-full-preview").src.endsWith("desert-dawn.webp"));
assert.equal(stored().settings.appearance.wallpaper, "none", "Preview must not apply before confirmation");
await click("Close wallpaper preview");
assert.equal(w.document.activeElement.getAttribute("aria-label"), "Preview Desert dawn");
await click("Favourite Desert dawn"); await click("Favourite Woodland waterfall");
await click("Favourites (2)");
assert.equal(w.document.querySelectorAll(".wallpaper-scene").length, 2);
await click("Rotate landscape daily");
assert.ok(["dunes", "waterfall"].includes(w.document.documentElement.dataset.wallpaper));
await click("Pause wallpaper");
assert.equal(w.document.documentElement.dataset.wallpaper, "none");
assert.equal(stored().settings.appearance.wallpaper, "daily");
await click("Resume wallpaper"); await click("Calm wallpaper preset");
await field("Wallpaper crop focus", "right");
assert.equal(stored().settings.appearance.visibility, 25);
assert.equal(stored().settings.appearance.blur, 4);
assert.equal(w.document.documentElement.style.getPropertyValue("--wallpaper-position"), "right");
await click("Preview Desert dawn"); await click("Apply wallpaper");
assert.equal(w.document.querySelectorAll("dialog[open]").length, 1);
assert.equal(w.document.documentElement.dataset.wallpaper, "dunes");
await click("Close dialog");
assert.equal(w.document.activeElement.getAttribute("aria-label"), "Open themes and wallpapers");
assert.equal(JSON.stringify(stored().sessions), unrelated);
const persisted = w.localStorage.getItem(key);
w.close(); w = open(persisted);
await until(() => w.document.querySelector(".book-shelf"), "Reload failed");
assert.equal(stored().books.plans[0].dailyTarget, 3);
assert.equal(stored().lectures.logs.length, 6);
assert.equal(w.document.documentElement.dataset.wallpaper, "dunes");
assert.equal(stored().settings.appearance.favourites.length, 2);
assert.equal(errors.length, 0, errors.join("\n"));
w.close();
console.log("Learning UI checks passed: visual chapter selection, goals, search/status filters, safe batch totals, history preservation, wallpaper previews/favourites/rotation/pause/crop, focus and reload.");
