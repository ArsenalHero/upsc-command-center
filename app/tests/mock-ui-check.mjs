import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {fixtureLicense,prepareMockDatabase,setMockUser} from "./mock-license-fixture.ts";
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from "node:fs";
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
const rpcHolds = new Map();
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
const token = (user, sessionId = user.id) =>
  base64({ alg: "HS256", typ: "JWT" }) +
  "." +
  base64({
    sub: user.id,
    session_id: sessionId,
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
let activeSessionId = null, nextRefreshSessionId = null;
const tokenSessions = new Map([[token(alice),alice.id],[token(bob),bob.id]]);
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Supabase-Api-Version": "2024-01-01",
    },
  });
const db=new PGlite();
await prepareMockDatabase(db,[{id:alice.id,admin:true},{id:bob.id}]);
let queryQueue=Promise.resolve();
const rpc=(owner,op,p,sessionId)=>{const run=queryQueue.catch(()=>{}).then(async()=>{await setMockUser(db,owner||null,sessionId ?? (owner===signedIn?.id?activeSessionId:owner) ?? null);return (await db.query("select public.mock_lab($1,$2::jsonb) data",[op,JSON.stringify(p||{})])).rows[0].data;});queryQueue=run;return run;};
await rpc(alice.id,"verify-license",{licenseKey:fixtureLicense});
await rpc(alice.id,"profile",{displayName:"Manager"});
const coaching=await rpc(alice.id,"admin-coaching",{name:"FORUM IAS"});
const testId=(await rpc(alice.id,"admin-test",{code:"UI-MOCK",name:"UI validation mock",paper:"GS-I",kind:"Sectional",year:2027,series:"Browser checks",duration:30,positive:2,negative:0.5,status:"active",coachingId:coaching.id,questions:["Alpha","Beta","Gamma"].map(topic=>({question:`Which ${topic} choice is correct?`,options:{a:"One",b:"Two",c:"Three",d:"Four"},correct:"a",explanation:"Verified explanation appears only after submission.",subject:"Polity",topic,positive:2,negative:0.5}))})).id;
await db.exec("reset role");await db.query("insert into mock_private.report_documents(test_id,kind,title,items) values($1,'recall','Recall Sheet · PT-01',$2::jsonb)",[testId,JSON.stringify([{number:1,title:"Constituent Assembly",text:"Members were indirectly elected by Provincial Legislative Assemblies."},{number:2,title:"Preamble",text:"The Constitution derives its authority from the people."},{number:3,title:"Fundamental Rights",text:"Fundamental Rights limit government power."}])]);
const payload=createEmptyData();payload.settings.setupCompleted=true;
payload.tests.push({id:"existing-manual-log",date:"2026-10-02",name:"Existing manual result",seriesId:"",subjectId:"",topicId:"",stage:"Prelims",score:70,maximum:100,rank:0,attempted:0,correct:0,strongTopics:"",weakTopics:"",errors:{},notes:"Original review note"});
workspaces.set(bob.id,{payload,revision:1,updated_at:new Date().toISOString()});
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
  if(url.pathname.endsWith("/rpc/mock_lab")){try{if(rpcHolds.has(body.op))await rpcHolds.get(body.op);return json(await rpc(owner?.id,body.op,body.p,tokenSessions.get(bearer)));}catch(e){return json({message:e.message,code:e.code},400);}}
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
    const refreshing=!!body.refresh_token;
    if (!refreshing && body.password !== "correct-password")
      return json(
        { code: "invalid_credentials", message: "Invalid login credentials" },
        400,
      );
    if(!refreshing)signedIn = body.email === bob.email ? bob : alice;
    activeSessionId=refreshing?(nextRefreshSessionId||activeSessionId):signedIn.id;
    nextRefreshSessionId=null;
    const sessionRun=queryQueue.catch(()=>{}).then(async()=>{await db.exec("reset role");await db.query("insert into auth.sessions(id,user_id) values($1,$2) on conflict(id) do nothing",[activeSessionId,signedIn.id]);});
    queryQueue=sessionRun;await sessionRun;
    const accessToken=token(signedIn,activeSessionId);users.set(accessToken,signedIn);tokenSessions.set(accessToken,activeSessionId);
    return json({
      access_token: accessToken,
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
    const run=queryQueue.catch(()=>{}).then(async()=>{await db.exec("reset role");await db.query("delete from auth.sessions where id=$1",[tokenSessions.get(bearer)]);});
    queryQueue=run;await run;
    signedIn = null;
    activeSessionId = null;
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
const dom = makeDOM("https://example.test/upsc/#/tests"),
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
const capture = (name) => {
  if (!process.env.MOCK_VISUAL_DIR) return;
  const css=readdirSync("dist/assets").filter(f=>f.endsWith(".css")).map(f=>readFileSync("dist/assets/"+f,"utf8")).join("\n");
  const snapshot=w.document.documentElement.cloneNode(true);
  snapshot.querySelectorAll("script").forEach(s=>s.remove());
  const style=w.document.createElement("style");style.textContent=css;snapshot.querySelector("head").appendChild(style);
  mkdirSync(process.env.MOCK_VISUAL_DIR,{recursive:true});
  writeFileSync(process.env.MOCK_VISUAL_DIR+"/"+name+".html","<!doctype html>"+snapshot.outerHTML);
};
w.eval(built.outputFiles[0].text);
try{
 await heading("Test series");
 for(const button of ["Add Test Series","Log test","Add Log","Mock Test"])assert.ok([...w.document.querySelectorAll("button")].some(b=>b.textContent.trim()===button));
 assert.ok(!apiCalls.some(c=>c.body.op==="catalog"));
 click("Add Log");await until(()=>w.document.querySelector("dialog[open]")?.textContent.includes("Add Test"),"Existing manual result editor");
 const logFields=[...w.document.querySelectorAll("dialog[open] label")].map(l=>l.textContent);
 assert.ok(logFields.some(l=>l.includes("Test name")));assert.ok(logFields.some(l=>l.includes("Maximum marks")));
 click("Cancel");click("Mock Test");await heading("Welcome back.");
 assert.ok(w.document.body.textContent.includes("Sign-in is required to access Mock Tests."));
 assert.ok(!w.document.body.textContent.includes("UI validation mock"));
 const signup=[...w.document.querySelectorAll("a")].find(a=>a.textContent.trim()==="Sign up");signup.click();await heading("Start your journey.");
 [...w.document.querySelectorAll("a")].find(a=>a.textContent.trim()==="Log in").click();await heading("Welcome back.");
 assert.ok(w.document.body.textContent.includes("Sign-in is required to access Mock Tests."));
 fill("auth-email",bob.email);fill("auth-password","correct-password");await new Promise(r=>setTimeout(r,30));submit();
 await heading("Verify your license key");await until(()=>w.document.getElementById("mock-license-key"),"Server license check");
 w.localStorage.setItem("mock-license-verified","true");w.sessionStorage.setItem("mock-license-verified","true");
 const checksBefore=apiCalls.filter(c=>c.body.op==="license-status").length;w.location.hash=`/tests/prelims/${testId}`;
 await until(()=>apiCalls.filter(c=>c.body.op==="license-status").length>checksBefore,"Direct URL access rechecked");
 await until(()=>w.document.getElementById("mock-license-key")&&!w.document.getElementById("mock-license-key").disabled,"Direct test URL requires license");
 assert.ok(!apiCalls.some(c=>c.body.op==="catalog"||c.body.op==="detail"));
 capture("mock-license");
 const statusCalls=()=>apiCalls.filter(c=>c.body.op==="license-status").length;
 const recheck=async()=>{const before=statusCalls();w.dispatchEvent(new w.Event("focus"));await until(()=>statusCalls()>before,"Background access recheck");await queryQueue.catch(()=>{});await new Promise(r=>setTimeout(r,30));};
 const licenseInput=w.document.getElementById("mock-license-key");
 fill("mock-license-key","incorrect-key");await new Promise(r=>setTimeout(r,30));await recheck();
 assert.equal(w.document.getElementById("mock-license-key"),licenseInput,"Tab focus retains the license input");
 assert.equal(licenseInput.value,"incorrect-key","Tab focus retains the entered key");
 submit();
 await until(()=>w.document.body.textContent.includes("Invalid license key. Please enter a valid license key."),"Wrong license retry");
 assert.ok(!w.document.body.textContent.includes("UI validation mock"));
 let releaseVerification;rpcHolds.set("verify-license",new Promise(resolve=>{releaseVerification=resolve;}));
 fill("mock-license-key",fixtureLicense);await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>w.document.body.textContent.includes("Verifying…"),"Verification pending");
 const pendingChecks=statusCalls();w.dispatchEvent(new w.Event("focus"));await new Promise(r=>setTimeout(r,30));
 assert.equal(statusCalls(),pendingChecks,"Focus does not cancel an in-flight verification");
 assert.ok(w.document.getElementById("mock-license-key").disabled);
 releaseVerification();rpcHolds.delete("verify-license");
 await until(()=>w.document.querySelector('[aria-label="Leaderboard display name"]'),"License verification returns to selected test");
 const name=w.document.querySelector('[aria-label="Leaderboard display name"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(name,"BrowserLearner");name.dispatchEvent(new w.Event("input",{bubbles:true}));await new Promise(r=>setTimeout(r,30));click("Start test");
 await until(()=>w.document.body.textContent.includes("Which Alpha choice"),"Test starts");
 capture("mock-exam");
 assert.ok(!w.document.body.textContent.includes("Verified explanation"));
 assert.ok(w.document.querySelector('progress[aria-label="Answer progress"]'));assert.ok(w.document.querySelector('[aria-label="Question states"]'));
 const choose=text=>{const value=text==='One'?'a':'b';const input=w.document.querySelector(`input[value="${value}"]`);assert.ok(input);input.click();};
 choose("One");await new Promise(r=>setTimeout(r,40));await queryQueue;
 const questionCard=w.document.querySelector(".mock-question"),attemptLoads=apiCalls.filter(c=>c.body.op==="attempt").length;
 await recheck();assert.equal(w.document.querySelector(".mock-question"),questionCard,"Focus keeps the active exam mounted");
 assert.equal(apiCalls.filter(c=>c.body.op==="attempt").length,attemptLoads,"Focus does not reload the exam");
 assert.ok(w.document.querySelector('input[value="a"]').checked);
 failures.set("/rest/v1/rpc/mock_lab",[{body:{message:"Connection temporarily unavailable",code:"test_connection_failure"},status:400}]);
 await recheck();assert.equal(w.document.querySelector(".mock-question"),questionCard,"A failed background check keeps the exam and selected answer");
 assert.ok(w.document.querySelector('input[value="a"]').checked);
 // Exercise token renewal through the real SDK's tab-visibility listener.
 const renewSession=async(nextId)=>{
  const storageKey="upsc-auth-session", session=JSON.parse(w.localStorage.getItem(storageKey));
  assert.ok(session);session.expires_at=Math.floor(Date.now()/1000)+10;
  w.localStorage.setItem(storageKey,JSON.stringify(session));nextRefreshSessionId=nextId||null;
  const refreshes=()=>apiCalls.filter(c=>c.path.endsWith("/token")&&c.body.refresh_token).length, before=refreshes();
  w.document.dispatchEvent(new w.Event("visibilitychange"));
  await until(()=>refreshes()>before,"Actual SDK refresh event");
  await queryQueue;await new Promise(r=>setTimeout(r,80));
 };
 await renewSession();assert.equal(w.document.querySelector(".mock-question"),questionCard,"Token refresh in the same session keeps the exam mounted");
 const freshSession="44444444-4444-4444-8444-444444444444";
 await renewSession(freshSession);await heading("Verify your license key");assert.ok(!w.document.querySelector(".mock-exam"),"Same user with a new Auth session must verify again");
 fill("mock-license-key",fixtureLicense);await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>w.document.body.textContent.includes("Which Alpha choice"),"New session resumes only after server verification");
 assert.ok(w.document.querySelector('input[value="a"]').checked);
 // A server denial still removes the exam and demands real re-verification.
 await queryQueue;await db.exec("reset role");await db.query("delete from mock_private.license_grants where user_id=$1",[bob.id]);
 await recheck();await heading("Verify your license key");assert.ok(!w.document.querySelector(".mock-exam"));
 fill("mock-license-key",fixtureLicense);await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>w.document.body.textContent.includes("Which Alpha choice"),"Authorized exam resumes after grant restoration");
 assert.ok(w.document.querySelector('input[value="a"]').checked,"Saved answer survives license re-verification");
 click("Save & Next");await until(()=>w.document.body.textContent.includes("Which Beta choice"),"Save and next");choose("Two");await new Promise(r=>setTimeout(r,40));click("Mark for review");await new Promise(r=>setTimeout(r,30));click("Save & exit");await until(()=>w.document.body.textContent.includes("My Tests"),"Save and exit");
 const history=await rpc(bob.id,"history",{});const attemptId=history[0].id;w.location.hash=`/tests/prelims/${testId}/attempt/${attemptId}`;await until(()=>w.document.body.textContent.includes("Which Beta choice"),"Resume question");click("Submit test");await until(()=>w.document.body.textContent.includes("Confirm submission"),"Submission confirmation");click("Confirm submission");await until(()=>w.document.body.textContent.includes("UI validation mock · Result"),"Submitted report");const result=await rpc(bob.id,"attempt",{attemptId});assert.equal(result.result.score,1.5);assert.equal(result.result.incorrect,1);click("Questions");await until(()=>w.document.body.textContent.includes("Verified explanation appears only after submission."),"Post-submission explanations");
 click("Recall Sheet");await until(()=>w.document.body.textContent.includes("Fundamental Rights limit government power."),"Protected text recall sheet");assert.equal(w.document.querySelectorAll(".mock-recall-entry").length,3);assert.ok(!w.document.querySelector("iframe"));assert.ok(!w.document.body.textContent.includes("Download PDF"));assert.ok(apiCalls.some(c=>c.body.op==="report-document"));
 const recallSearch=w.document.querySelector('[aria-label="Search recall sheet"]');Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(recallSearch,"Q2");recallSearch.dispatchEvent(new w.Event("input",{bubbles:true}));await until(()=>w.document.querySelectorAll(".mock-recall-entry").length===1,"Search recall entries by number");assert.ok(w.document.querySelector(".mock-recall-entry").textContent.includes("Q2. Preamble"));Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(recallSearch,"");recallSearch.dispatchEvent(new w.Event("input",{bubbles:true}));await until(()=>w.document.querySelectorAll(".mock-recall-entry").length===3,"Restore full recall sheet");
 click("Community Comparison");await until(()=>w.document.body.textContent.includes("5"),"Honest community threshold");
 w.location.hash="/tests";await heading("Test series");await until(()=>w.document.querySelector("table")?.textContent.includes("Existing manual result"),"Existing manual history preserved");
 click("Add Log");await until(()=>w.document.querySelector("dialog[open]"),"Manual Add Log still opens after mocks");
 const fillManual=(label,value)=>{const input=[...w.document.querySelectorAll("dialog[open] label")].find(l=>l.querySelector("span")?.textContent?.trim().startsWith(label))?.querySelector("input");assert.ok(input,"Manual field "+label);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set.call(input,value);input.dispatchEvent(new w.Event("input",{bubbles:true}));};
 fillManual("Test name","New manual result");fillManual("Score","80");fillManual("Maximum marks","100");await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>w.document.querySelector("table")?.textContent.includes("New manual result"),"Manual save creates history row");
 await until(()=>workspaces.get(bob.id).payload.tests.some(t=>t.name==="New manual result"),"Existing workspace API saves manual result");
 assert.equal(workspaces.get(bob.id).payload.tests.find(t=>t.id==="existing-manual-log").notes,"Original review note");
 const originalRow=[...w.document.querySelectorAll("tr")].find(r=>r.textContent.includes("Existing manual result"));
 originalRow.querySelector('[aria-label="Edit Test"]').click();await until(()=>w.document.querySelector("dialog[open]")?.textContent.includes("Edit Test"),"Manual edit preserved");fillManual("Score","75");await new Promise(r=>setTimeout(r,30));submit();
 await until(()=>workspaces.get(bob.id).payload.tests.find(t=>t.id==="existing-manual-log").score===75,"Manual update persists");
 click("Mock Test");await until(()=>w.document.body.textContent.includes("UI validation mock"),"Verified session remembers access");assert.ok(!w.document.getElementById("mock-license-key"));
 click("View syllabus");await until(()=>w.document.body.textContent.includes("Test syllabus"),"Syllabus popup preserved");click("Close syllabus");
 w.location.hash="/account";await heading("Your account");click("Sign out");await heading("Welcome back.");
 w.location.hash=`/tests/prelims/${testId}/attempt/${attemptId}`;await until(()=>w.location.hash==="#/login"&&w.document.body.textContent.includes("Sign-in is required"),"Direct attempt URL cannot bypass sign-in");
 assert.ok(!w.document.body.textContent.includes("Which Beta choice"));assert.ok(!w.document.body.textContent.includes("Verified explanation"));
 fill("auth-email",bob.email);fill("auth-password","correct-password");await new Promise(r=>setTimeout(r,30));submit();
 await heading("Verify your license key");await until(()=>w.document.getElementById("mock-license-key"),"New sign-in requires fresh license");
 assert.ok(!w.document.querySelector(".mock-exam"));w.location.hash="/tests";await heading("Test series");
 await until(()=>w.document.querySelector("table")?.textContent.includes("Existing manual result"),"Manual history remains available without mock license");
 assert.deepEqual(messages,[]);console.log("Mock UI checks passed: manual Add Log preserved, signed-in license gate, wrong-key retry, direct-URL protection, license input and exam preserved on focus, pending verification, temporary connection failure, token renewal, new-session verification, server revocation, Save & Next, review flags, exit/resume, confirmation, server score and explanation release.");
}finally{dom.window.close();await queryQueue.catch(()=>{});await db.close();}
