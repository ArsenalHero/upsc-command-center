import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";

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
  if (url.pathname.endsWith("/auth-config.json"))
    return json({
      url: "https://test-project.supabase.co",
      publishableKey: "sb_publishable_example",
    });
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
const dom = makeDOM(),
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
try {
  await heading("Welcome back.");
  assert.equal(
    w.document.querySelector('button[type="submit"]').disabled,
    false,
  );
  w.location.hash = "/signup";
  await heading("Start your journey.");
  fill("auth-name", "Alice");
  fill("auth-email", alice.email);
  fill("auth-password", "correct-password");
  fill("auth-confirm", "wrong-password");
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () => w.document.body.textContent.includes("The passwords don't match."),
    "Mismatch validation missing",
  );
  assert.equal(apiCalls.filter((c) => c.path.endsWith("/signup")).length, 0);
  fill("auth-confirm", "correct-password");
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () => w.document.body.textContent.includes("Check your inbox"),
    "Confirmation screen missing",
  );
  assert.equal(
    apiCalls.find((c) => c.path.endsWith("/signup")).query.get("redirect_to"),
    "https://example.test/upsc/?auth=confirm",
  );
  click("Resend confirmation");
  await until(
    () => apiCalls.some((c) => c.path.endsWith("/resend")),
    "Resend was not called",
  );
  w.location.hash = "/forgot-password";
  await heading("Forgot your password?");
  fill("auth-email", alice.email);
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () => w.document.body.textContent.includes("If this email has an account"),
    "Recovery privacy message missing",
  );
  assert.equal(
    apiCalls.find((c) => c.path.endsWith("/recover")).query.get("redirect_to"),
    "https://example.test/upsc/?auth=recovery",
  );
  w.location.hash = "/login";
  await heading("Welcome back.");
  fill("auth-email", alice.email);
  fill("auth-password", "wrong-password");
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () => w.document.body.textContent.includes("Check your email and password"),
    "Login error missing",
  );
  assert.equal(workspaces.size, 0);
  fill("auth-password", "correct-password");
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () =>
      w.document.body.textContent.includes("Set up your preparation workspace"),
    "Authenticated workspace missing",
  );
  click("Skip setup");
  await until(() => workspaces.has(alice.id), "Alice setup did not sync");
  w.location.hash = "/daily-study";
  await heading("Daily study");
  click("Add study session");
  await until(
    () => w.document.body.textContent.includes("Add Study Session"),
    "Study form missing",
  );
  click("Save record");
  await until(
    () => workspaces.get(alice.id)?.payload.sessions.length === 1,
    "Study record did not sync",
  );
  w.location.hash = "/pyqs";
  await heading("2025 Prelims PYQs");
  w.document.querySelector('[aria-label="Practise 2025 GS I Q1"]').click();
  await heading("2025 · Prelims GS-I");
  w.document.querySelector('input[name="pyq-option"][value="a"]').click();
  await new Promise((r) => setTimeout(r, 10));
  click("Submit answer");
  await until(() => workspaces.get(alice.id)?.payload.pyqs.length === 1, "Question attempt did not sync to Alice's account");
  assert.equal(workspaces.get(alice.id).payload.pyqs[0].attempt.questionId, "upsc-2025-prelims-gs1-a-001");
  w.location.hash = "/account";
  await heading("Your account");
  assert.match(w.document.body.textContent, /alice@example.test/);
  await until(() => w.document.querySelector(".storage-status.sync-synced"), "Alice's final question checkpoint did not finish syncing");
  click("Sign out");
  await heading("Welcome back.");
  assert.equal(
    w.localStorage.getItem("upsc-command-center:account:" + alice.id + ":v1"),
    null,
  );
  assert.equal(w.localStorage.getItem("upsc-auth-session"), null);
  fill("auth-email", bob.email);
  fill("auth-password", "correct-password");
  await new Promise((r) => setTimeout(r, 10));
  submit();
  await until(
    () =>
      w.document.body.textContent.includes("Set up your preparation workspace"),
    "Bob private setup missing",
  );
  click("Skip setup");
  await until(() => workspaces.has(bob.id), "Bob workspace did not sync");
  assert.equal(workspaces.get(bob.id).payload.sessions.length, 0);
  assert.equal(workspaces.get(bob.id).payload.pyqs.length, 0);
  assert.equal(workspaces.get(alice.id).payload.sessions.length, 1);
  assert.equal(workspaces.get(alice.id).payload.pyqs.length, 1);
  w.location.hash = "/account";
  await heading("Your account");
  assert.match(w.document.body.textContent, /bob@example.test/);
  assert.doesNotMatch(w.document.body.textContent, /alice@example.test/);
  await until(() => w.document.querySelector(".storage-status.sync-synced"), "Bob's setup did not finish syncing");
  click("Sign out");
  await heading("Welcome back.");
  const recovery = makeDOM(
    "https://example.test/upsc/?auth=recovery#access_token=" +
      token(alice) +
      "&refresh_token=refresh-alice&expires_in=3600&token_type=bearer&type=recovery",
  );
  try {
    const rw = recovery.window;
    rw.eval(built.outputFiles[0].text);
    await until(
      () =>
        rw.document.querySelector("h1")?.textContent ===
        "Choose a new password.",
      "Recovery callback did not open password form",
    );
    assert.equal(rw.location.href.includes("access_token"), false);
    assert.equal(rw.location.search, "");
    const setRecoveryField = (id, value) => {
      const field = rw.document.getElementById(id);
      Object.getOwnPropertyDescriptor(
        rw.HTMLInputElement.prototype,
        "value",
      ).set.call(field, value);
      field.dispatchEvent(new rw.Event("input", { bubbles: true }));
    };
    setRecoveryField("auth-password", "new-correct-password");
    setRecoveryField("auth-confirm", "new-correct-password");
    await new Promise((r) => setTimeout(r, 10));
    rw.document
      .querySelector("form")
      .dispatchEvent(
        new rw.Event("submit", { bubbles: true, cancelable: true }),
      );
    await until(
      () =>
        apiCalls.some(
          (c) =>
            c.path.endsWith("/user") &&
            c.body.password === "new-correct-password",
        ),
      "Recovery password update was not sent",
    );
    await until(
      () =>
        rw.document.querySelector("h1")?.textContent ===
        "UPSC PREPARATION COMMAND CENTER",
      "Recovery did not return to the workspace",
    );
  } finally {
    recovery.window.close();
  }
  const confirmation = makeDOM(
    "https://example.test/upsc/?token_hash=confirmation-token&type=email",
  );
  try {
    const cw = confirmation.window;
    cw.eval(built.outputFiles[0].text);
    await until(
      () =>
        cw.document.querySelector("h1")?.textContent ===
        "UPSC PREPARATION COMMAND CENTER",
      "Email verification callback did not open workspace",
    );
    assert.equal(cw.location.search, "");
    assert.equal(cw.location.hash, "#/");
    assert.ok(
      apiCalls.some(
        (c) =>
          c.path.endsWith("/verify") &&
          c.body.token_hash === "confirmation-token",
      ),
    );
  } finally {
    confirmation.window.close();
  }
  assert.equal(messages.length, 0, messages.join("\n"));
  console.log(
    "Auth UI checks passed: sign-up confirmation, resend, forgot password, recovery callback/password change, verification callback, invalid login, actual SDK login/logout, cloud save, cache cleanup, and two isolated accounts (simulated API).",
  );
} finally {
  dom.window.close();
}
