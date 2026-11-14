import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";

const options = { bundle: true, write: false, format: "iife", platform: "browser", target: "es2022", loader: { ".css": "empty" }, define: { "import.meta.env": JSON.stringify({ PROD: false }) }, jsx: "automatic" };
const app = await build({ ...options, entryPoints: ["src/main.tsx"] });
const errors = [], calls = [], opened = [], vc = new VirtualConsole();
vc.on("jsdomError", error => { if (!String(error).includes("navigation")) errors.push(String(error)); });
function open(saved = {}, route = "/") {
  const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "https://example.test/upsc/#" + route, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  opened.push(dom); const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.structuredClone = structuredClone; w.scrollTo = () => {};
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.fetch = async url => { calls.push(String(url)); return { ok: true, json: async () => ({ url: "", publishableKey: "" }) }; };
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
  w.eval(app.outputFiles[0].text); return w;
}
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
let w = open();
async function until(predicate, message) { for (let n = 0; n < 150; n++) { if (predicate()) return; await wait(); } assert.fail(message + ": " + w.document.body.textContent.slice(-1000)); }
const popup = () => w.document.querySelector("dialog.welcome-dialog[open]");
async function click(text, scope = w.document) { const el = [...scope.querySelectorAll("button")].find(b => b.textContent.trim() === text); assert.ok(el, "Missing button " + text); el.click(); await wait(); }
async function name(value) { const input = popup().querySelector('input[name="guestName"]'); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(); }
const submit = () => popup().querySelector("form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
try {
  await until(() => w.document.querySelector("h1")?.textContent === "Welcome back.", "Initial account choices");
  await click("Continue as guest");
  await until(() => popup()?.querySelector('input[name="guestName"]'), "Name-only guest prompt");
  assert.equal(popup().querySelectorAll("input,select,textarea").length, 1);
  assert.equal(w.document.activeElement, popup().querySelector("input"));
  assert.ok(!w.document.body.textContent.includes("Set up your preparation workspace"));
  await name("   "); submit();
  await until(() => popup().querySelector('[role="alert"]'), "Blank names rejected");
  assert.equal(w.localStorage.getItem("upsc-guest-profile:v1"), null);
  await name("  Asha   Rao  "); submit();
  await until(() => popup()?.querySelector("h2")?.textContent.includes("Asha Rao"), "Personal greeting after name entry");
  assert.equal(JSON.parse(w.localStorage.getItem("upsc-guest-profile:v1")).name, "Asha Rao");
  const firstQuote = popup().querySelector("blockquote p").textContent;
  assert.ok(firstQuote.length > 15);
  assert.equal(w.document.activeElement.textContent.trim(), "Let’s study");
  await click("Change name", popup()); await name("आर्या"); submit();
  await until(() => popup()?.querySelector("h2")?.textContent.includes("आर्या"), "Unicode guest name change");
  assert.equal(popup().querySelector("blockquote p").textContent, firstQuote, "Changing a name does not change the visit's quote");
  await click("Let’s study", popup());
  await until(() => !popup(), "Welcome dismissed");
  assert.equal(JSON.parse(w.localStorage.getItem("upsc-command-center:v1")).settings.setupCompleted, true);
  w.location.hash = "/daily-study";
  await until(() => w.document.querySelector("h1")?.textContent === "Daily study", "Guest workspace available immediately");
  assert.equal(popup(), null, "No repeated greeting during page navigation");
  await click("Add study session"); await until(() => w.document.querySelector('dialog input[name="actualMinutes"]'), "Guest study form");
  await click("30m"); await click("Save session");
  await until(() => JSON.parse(w.localStorage.getItem("upsc-command-center:v1")).sessions.length === 1, "Guest study history saved");
  const saved = Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)]));
  const history = saved["upsc-command-center:v1"];
  w = open(saved, "/daily-study");
  await until(() => popup()?.querySelector("h2")?.textContent.includes("आर्या"), "Returning guest greeted by name without login");
  assert.equal(popup().querySelector("input"), null, "Returning guests are not asked their name again");
  assert.notEqual(popup().querySelector("blockquote p").textContent, firstQuote, "A new visit rotates the quote");
  assert.equal(w.localStorage.getItem("upsc-command-center:v1"), history, "Opening a greeting preserves saved records");
  await click("Let’s study", popup());
  w.dispatchEvent(new w.Event("focus")); await wait();
  assert.equal(popup(), null, "Normal tab focus does not interrupt study with a greeting");
  w.dispatchEvent(new w.PageTransitionEvent("pageshow", { persisted: true }));
  await until(() => popup()?.querySelector("h2")?.textContent.includes("आर्या"), "A browser-restored visit gets a greeting");
  popup().dispatchEvent(new w.Event("cancel", { cancelable: true })); await wait();
  assert.equal(popup(), null, "Escape dismisses a returning greeting");
  assert.ok(!calls.some(url => /signup|token|study_workspaces/.test(url)), "Guest welcome creates no account or cloud workspace");

  w = open({ "upsc-guest-profile:v1": JSON.stringify({ name: "Meera" }) });
  await until(() => popup()?.querySelector("h2")?.textContent.includes("Meera"), "A saved name alone restores guest entry on a new tab");
  await until(() => w.document.querySelector("h1")?.textContent === "Your preparation", "Named guest workspace loads without account choices");
  await click("Let’s study", popup());
  w = open(); await until(() => w.document.querySelector("h1")?.textContent === "Welcome back.", "Fresh visitor entry");
  await click("Continue as guest"); await until(() => popup(), "Cancellable name entry");
  await click("Cancel", popup()); await until(() => w.document.querySelector("h1")?.textContent === "Welcome back.", "Cancel returns to account choices");
  assert.equal(w.localStorage.getItem("upsc-guest-profile:v1"), null);
  assert.deepEqual(errors, []);
  console.log("Welcome UI passed: name-only entry, normalization, editable names, greeting and quote, new-tab/reload persistence, quote rotation, no route/focus interruptions, browser restoration, preserved study history, cancellation and no account creation.");
} finally { for (const dom of opened) dom.window.close(); }

const account = await build({ ...options, stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {HashRouter} from 'react-router-dom';import {WelcomeDialog} from './src/components/WelcomeDialog';function Harness(){const [n,setN]=React.useState(0);globalThis.repaint=()=>setN(x=>x+1);return <HashRouter><WelcomeDialog key={n}/></HashRouter>;}createRoot(document.getElementById('root')).render(<Harness/>);` }, plugins: [{ name: "account-fixture", setup(b) {
  b.onResolve({ filter: /\/hooks\/use(Auth|Data)$/ }, args => ({ path: args.path.endsWith("useAuth") ? "auth" : "data", namespace: "fixture" }));
  b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "auth" ? "export const useAuth=()=>globalThis.accountAuth;" : "export const useData=()=>globalThis.accountData;" }));
} }] });
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "https://example.test/#/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
try {
  const a = dom.window;
  a.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  a.accountAuth = { user: { id: "account-user", email: "account@example.test", user_metadata: { display_name: "Account learner" } }, guestName: "Unrelated guest", welcomeQuote: "One careful revision is a step forward.", welcomeOpen: true, dismissWelcome() {}, saveGuestName() { assert.fail("Account name must not enter the guest profile"); } };
  a.accountData = { data: { settings: { setupCompleted: false } }, updateSettings() { assert.fail("Account welcome must not rewrite account settings"); } };
  a.eval(account.outputFiles[0].text); await wait();
  assert.equal(a.document.querySelector("dialog"), null, "An account's setup and welcome do not overlap");
  a.accountData.data.settings.setupCompleted = true; a.repaint(); await wait();
  assert.match(a.document.querySelector("dialog h2").textContent, /Account learner/);
  assert.ok(!a.document.body.textContent.includes("Unrelated guest"));
  assert.equal(a.document.querySelector("input"), null);
  assert.ok(a.document.querySelector("blockquote"));
  console.log("Account welcome passed: existing account name, no guest-name leakage, no extra fields and no overlap with setup.");
} finally { dom.window.close(); }
