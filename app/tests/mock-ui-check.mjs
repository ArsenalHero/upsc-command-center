import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {createEmptyData} from "../src/data/defaults.ts";

// Run the actual Auth SDK and React forms against a deterministic fake API.
// Live service configuration and email delivery require a connected project.
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
const messages = [],
  vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  if (!String(e).includes("navigation")) messages.push(String(e));
});
const apiCalls = [],
  workspaces = new Map();
const failures = new Map();
const alice = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "alice@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { display_name: "Alice" },
  created_at: "2026-10-02T00:00:00Z",
};
const bob = {
  ...alice,
  id: "22222222-2222-2222-2222-222222222222",
  email: "bob@example.test",
  user_metadata: { display_name: "Bob" },
};
const base64 = (object) =>
  Buffer.from(JSON.stringify(object)).toString("base64url");
const tokenExpiry = Math.floor(Date.now() / 1000) + 3600;
const token = (user) =>
  base64({ alg: "HS256", typ: "JWT" }) +
  "." +
  base64({
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    exp: tokenExpiry,
  }) +
  ".test-signature";
const users = new Map([
  [token(alice), alice],
  [token(bob), bob],
]);
let signedIn = null;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Supabase-Api-Version": "2024-01-01",
    },
  });
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;insert into auth.users values('${alice.id}',now(),false,'{"mock_admin":true}'),('${bob.id}',now(),false,'{}');`);
await db.exec(readFileSync("supabase/sql/mock-lab.sql","utf8"));
let queryQueue=Promise.resolve();
const rpc=(owner,op,p)=>{const run=queryQueue.catch(()=>{}).then(async()=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${owner||""}',false);set role ${owner?"authenticated":"anon"};`);return (await db.query("select public.mock_lab($1,$2::jsonb) data",[op,JSON.stringify(p||{})])).rows[0].data;});queryQueue=run;return run;};
await rpc(alice.id,"profile",{displayName:"Manager"});
const coaching=await rpc(alice.id,"admin-coaching",{name:"FORUM IAS"});
const testId=(await rpc(alice.id,"admin-test",{code:"UI-MOCK",name:"UI validation mock",paper:"GS-I",kind:"Sectional",year:2027,series:"Browser checks",duration:30,positive:2,negative:0.5,status:"active",coachingId:coaching.id,questions:["Alpha","Beta","Gamma"].map(topic=>({question:`Which ${topic} choice is correct?`,options:{a:"One",b:"Two",c:"Three",d:"Four"},correct:"a",explanation:"Verified explanation appears only after submission.",subject:"Polity",topic,positive:2,negative:0.5}))})).id;
await db.exec("reset role");await db.query("insert into mock_private.report_documents(test_id,kind,title,items) values($1,'recall','Recall Sheet · PT-01',$2::jsonb)",[testId,JSON.stringify([{number:1,title:"Constituent Assembly",text:"Members were indirectly elected by Provincial Legislative Assemblies."},{number:2,title:"Preamble",text:"The Constitution derives its authority from the people."},{number:3,title:"Fundamental Rights",text:"Fundamental Rights limit government power."}])]);
const payload=createEmptyData();payload.settings.setupCompleted=true;workspaces.set(bob.id,{payload,revision:1,updated_at:new Date().toISOString()});
const fakeFetch = async (input, options = {}) => {
  const url = new URL(String(input)),
    body = options.body ? JSON.parse(options.body) : {};
  const headers = new Headers(options.headers),
    bearer = headers.get("Authorization")?.replace("Bearer ", ""),
    owner = users.get(bearer);
  apiCalls.push({
    path: url.pathname,
    query: url.searchParams,
    body,
    owner: owner?.id,
  });
  const failure = failures.get(url.pathname)?.shift();
  if (failure) return json(failure.body, failure.status);
  if (url.pathname.endsWith("/auth-config.json"))
    return json({
      url: "https://test-project.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  if(url.pathname.endsWith("/rpc/mock_lab")){try{return json(await rpc(owner?.id,body.op,body.p));}catch(e){return json({message:e.message,code:e.code},400);}}
  if (url.pathname.endsWith("/signup"))
    return json({ user: { ...alice, email: body.email } });
  if (url.pathname.endsWith("/resend") || url.pathname.endsWith("/recover"))
    return json({});
  if (url.pathname.endsWith("/verify"))
    return json({
      access_token: token(alice),
      refresh_token: "refresh-alice",
      expires_in: 3600,
      token_type: "bearer",
      user: alice,
    });
  if (url.pathname.endsWith("/token")) {
    if (body.password !== "correct-password")
      return json(
        { code: "invalid_credentials", message: "Invalid login credentials" },
        400,
      );
    signedIn = body.email === bob.email ? bob : alice;
    return json({
      access_token: token(signedIn),
      refresh_token: "refresh-" + signedIn.id,
      expires_in: 3600,
      token_type: "bearer",
      user: signedIn,
    });
  }
  if (url.pathname.endsWith("/user")) {
    if (!owner)
      return json({ code: "bad_jwt", message: "Invalid session" }, 401);
    if (options.method === "PUT") return json({ user: owner });
    return json({ user: owner });
  }
  if (url.pathname.endsWith("/logout")) {
    signedIn = null;
    return new Response(null, { status: 204 });
  }
  if (url.pathname.endsWith("/study_workspaces")) {
    if (!owner) return json({ message: "Not authorized" }, 401);
    const row = workspaces.get(owner.id);
    return json(row ? [row] : []);
  }
  if (url.pathname.endsWith("/rpc/save_study_workspace")) {
    if (!owner) return json({ message: "Not authorized" }, 401);
    const row = workspaces.get(owner.id);
    if ((row?.revision ?? 0) !== body.p_expected_revision)
      return json({ code: "P0001", message: "workspace_conflict" }, 400);
    const saved = {
      payload: body.p_payload,
      revision: body.p_expected_revision + 1,
      updated_at: new Date().toISOString(),
    };
    workspaces.set(owner.id, saved);
    return json([{ revision: saved.revision, updated_at: saved.updated_at }]);
  }
  throw new Error("Unexpected fake API path: " + url.pathname);
};
function makeDOM(url = "https://example.test/upsc/#/login") {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    {
      url,
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: vc,
    },
  );
  const w = dom.window;
  w.fetch = fakeFetch;
  w.Headers = Headers;
  w.Request = Request;
  w.Response = Response;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.structuredClone = structuredClone;
  w.scrollTo = () => {};
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  return dom;
}
const dom = makeDOM("https://example.test/upsc/#/tests/prelims/discover"),
  w = dom.window;
const until = async (predicate, message) => {
  for (let i = 0; i < 160; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.ok(
    predicate(),
    message + ": " + w.document.body.textContent.slice(-1200),
  );
};
const heading = (title) =>
  until(
    () => w.document.querySelector("h1")?.textContent === title,
    "Missing heading " + title,
  );
const click = (label) => {
  const button = [...w.document.querySelectorAll("button")].find(
    (e) => e.textContent.trim() === label,
  );
  assert.ok(button, "Missing button " + label);
  button.click();
};
const fill = (id, value) => {
  const element = w.document.getElementById(id);
  assert.ok(element, "Missing field " + id);
  Object.getOwnPropertyDescriptor(
    w.HTMLInputElement.prototype,
    "value",
  ).set.call(element, value);
  element.dispatchEvent(new w.Event("input", { bubbles: true }));
};
const submit = () =>
  w.document
    .querySelector("form")
    .dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
w.eval(built.outputFiles[0].text);
try{
 await until(()=>w.document.body.textContent.includes("UI validation mock"),"Public catalogue");
 assert.ok(w.document.body.textContent.includes("MUROF SAI"));click("View syllabus");await until(()=>w.document.body.textContent.includes("Test syllabus"),"Syllabus popup");click("Close syllabus");
 w.location.hash=`/tests/prelims/${testId}`;
 await until(()=>w.document.body.textContent.includes("Keep every attempt in your own account"),"Guest sign-in gate");
 assert.ok(!w.document.body.textContent.includes("Verified explanation"));
 [...w.document.querySelectorAll("a")].find(e=>e.textContent.trim()==="Log in"&&e.closest(".mock-gate")).click();
 await heading("Welcome back.");fill("auth-email",bob.email);fill("auth-password","correct-password");await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>w.document.querySelector('[aria-label="Leaderboard display name"]'),"Login returns to selected test");
 const name=w.document.querySelector('[aria-label="Leaderboard display name"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(name,"BrowserLearner");name.dispatchEvent(new w.Event("input",{bubbles:true}));await new Promise(r=>setTimeout(r,30));click("Start test");
 await until(()=>w.document.body.textContent.includes("Which Alpha choice"),"Test starts");
 assert.ok(!w.document.body.textContent.includes("Verified explanation"));
 const choose=text=>{const value=text==='One'?'a':'b';const input=w.document.querySelector(`input[value="${value}"]`);assert.ok(input);input.click();};
 choose("One");await new Promise(r=>setTimeout(r,40));click("Save & Next");await until(()=>w.document.body.textContent.includes("Which Beta choice"),"Save and next");choose("Two");await new Promise(r=>setTimeout(r,40));click("Mark for review");await new Promise(r=>setTimeout(r,30));click("Save & exit");await until(()=>w.document.body.textContent.includes("My Tests"),"Save and exit");
 const history=await rpc(bob.id,"history",{});const attemptId=history[0].id;w.location.hash=`/tests/prelims/${testId}/attempt/${attemptId}`;await until(()=>w.document.body.textContent.includes("Which Beta choice"),"Resume question");click("Submit test");await until(()=>w.document.body.textContent.includes("Confirm submission"),"Submission confirmation");click("Confirm submission");await until(()=>w.document.body.textContent.includes("UI validation mock · Result"),"Submitted report");const result=await rpc(bob.id,"attempt",{attemptId});assert.equal(result.result.score,1.5);assert.equal(result.result.incorrect,1);click("Questions");await until(()=>w.document.body.textContent.includes("Verified explanation appears only after submission."),"Post-submission explanations");
 click("Recall Sheet");await until(()=>w.document.body.textContent.includes("Fundamental Rights limit government power."),"Protected text recall sheet");assert.equal(w.document.querySelectorAll(".mock-recall-entry").length,3);assert.ok(!w.document.querySelector("iframe"));assert.ok(!w.document.body.textContent.includes("Download PDF"));assert.ok(apiCalls.some(c=>c.body.op==="report-document"));
 const recallSearch=w.document.querySelector('[aria-label="Search recall sheet"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(recallSearch,"Q2");recallSearch.dispatchEvent(new w.Event("input",{bubbles:true}));await until(()=>w.document.querySelectorAll(".mock-recall-entry").length===1,"Search recall entries by number");assert.ok(w.document.querySelector(".mock-recall-entry").textContent.includes("Q2. Preamble"));Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(recallSearch,"");recallSearch.dispatchEvent(new w.Event("input",{bubbles:true}));await until(()=>w.document.querySelectorAll(".mock-recall-entry").length===3,"Restore full recall sheet");
 click("Community Comparison");await until(()=>w.document.body.textContent.includes("5"),"Honest community threshold");
 assert.deepEqual(messages,[]);console.log("Mock UI checks passed: guest catalogue, safe login return, private exam, Save & Next, review flags, exit/resume, confirmation, server score and explanation release.");
}finally{dom.window.close();await queryQueue.catch(()=>{});await db.close();}
