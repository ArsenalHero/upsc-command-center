import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { coreChunks } from "../scripts/generate-sw.mjs";
import { renderServiceWorker } from "../scripts/service-worker.mjs";

const scope = "https://example.test/upsc/", current = "upsc-static-test", runtime = "upsc-assets-v2";
const core = ["./index.html", "./assets/app-hash.js", "./wallpapers/forest.webp"];
const assets = [...core.slice(1), "./assets/questions-bank-hash.js", "./paper-figures/figure.svg"];
function worker() {
  const storage = new Map<string, Map<string, Response>>(), listeners: Record<string, (event: any) => void> = {};
  const fetched: string[] = [], installed: string[] = [];
  let offline = false, rejectWrites = false, claimed = false, skipped = false, preload = false;
  const key = (input: any) => input.url || String(input);
  const open = async (name: string) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const values = storage.get(name)!;
    return {
      match: async (input: any) => values.get(key(input))?.clone(),
      put: async (input: any, response: Response) => { if (rejectWrites) throw new Error("Quota exceeded"); values.set(key(input), response.clone()); },
      addAll: async (requests: Request[]) => { for (const request of requests) { installed.push(request.url); values.set(request.url, new Response(`core:${request.url}`)); } },
      keys: async () => [...values.keys()].map(url => new Request(url)),
      delete: async (input: any) => values.delete(key(input)),
    };
  };
  runInNewContext(renderServiceWorker(current, core, assets), {
    URL, Request, Response, Set, Promise,
    caches: { open, keys: async () => [...storage.keys()], delete: async (name: string) => storage.delete(name) },
    fetch: async (request: Request) => { fetched.push(request.url); if (offline) throw new TypeError("Offline"); return new Response(`network:${request.url}`); },
    self: { registration: { scope, navigationPreload: { enable: async () => { preload = true; } } }, clients: { claim: async () => { claimed = true; } }, skipWaiting: async () => { skipped = true; }, addEventListener: (name: string, fn: (event: any) => void) => { listeners[name] = fn; } },
  });
  return {
    storage, fetched, installed, open,
    offline: (value: boolean) => { offline = value; }, rejectWrites: () => { rejectWrites = true; },
    flags: () => ({ claimed, skipped, preload }),
    lifecycle: async (name: string) => { const waits: Promise<unknown>[] = []; listeners[name]({ waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits); },
    request: async (path: string, options: { mode?: string; method?: string; preloaded?: Response } = {}) => {
      const waits: Promise<unknown>[] = []; let response: Promise<Response> | undefined;
      const request = { url: new URL(path, scope).href, method: options.method || "GET", mode: options.mode || "cors" };
      listeners.fetch({ request, preloadResponse: options.preloaded ? Promise.resolve(options.preloaded) : undefined, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => { response = p; } });
      const result = response ? await response : undefined;
      await Promise.all(waits);
      return result;
    },
  };
}

test("offline build follows static dependencies and keeps question libraries out of core pages", () => {
  const manifest = {
    "index.html": { file: "assets/app.js", isEntry: true, css: ["assets/app.css"], imports: ["shared"], dynamicImports: ["src/pages/PYQs.tsx"] },
    shared: { file: "assets/shared.js", imports: ["index.html"] },
    "src/pages/Books.tsx": { file: "assets/books.js", isDynamicEntry: true, imports: ["shared"] },
    "src/pages/PYQs.tsx": { file: "assets/pyqs.js", isDynamicEntry: true, imports: ["questions"] },
    questions: { file: "assets/questions-bank-hash.js" },
  };
  assert.deepEqual(coreChunks(manifest), ["./assets/app.css", "./assets/app.js", "./assets/books.js", "./assets/shared.js"]);
  assert.throws(() => coreChunks({ ...manifest, "src/pages/Books.tsx": { ...manifest["src/pages/Books.tsx"], imports: ["questions"] } }), /eagerly imports/);
});

test("worker installs the study shell and landscapes without fetching question banks", async () => {
  const w = worker(); await w.lifecycle("install");
  assert.deepEqual(w.installed, core.map(path => new URL(path, scope).href));
  assert.equal(w.installed.some(path => path.includes("questions")), false);
  assert.equal(w.flags().skipped, true);
  const asset = await w.request("assets/app-hash.js");
  assert.match(await asset!.text(), /^core:/); assert.equal(w.fetched.length, 0);
});

test("opened question banks reuse the cache and remain available offline", async () => {
  const w = worker(); await w.lifecycle("install");
  const first = await w.request("assets/questions-bank-hash.js"); assert.match(await first!.text(), /^network:/);
  assert.equal(w.fetched.length, 1);
  w.offline(true);
  const second = await w.request("assets/questions-bank-hash.js"); assert.match(await second!.text(), /^network:/);
  assert.equal(w.fetched.length, 1, "A cached immutable asset must not start another network request");
  const unviewed = await w.request("paper-figures/figure.svg");
  assert.equal(unviewed!.status, 503);
});

test("worker upgrades preserve current question assets and unrelated caches", async () => {
  const w = worker();
  await (await w.open("upsc-static-old")).put(new URL("./index.html", scope).href, new Response("old shell"));
  await (await w.open("other-app-cache")).put("https://other.test/file", new Response("keep"));
  await (await w.open(runtime)).put(new URL("./assets/questions-bank-hash.js", scope).href, new Response("keep question bank"));
  await (await w.open(runtime)).put(new URL("./assets/obsolete-hash.js", scope).href, new Response("remove obsolete asset"));
  await w.lifecycle("install"); await w.lifecycle("activate");
  assert.equal(w.storage.has("upsc-static-old"), false); assert.equal(w.storage.has("other-app-cache"), true);
  assert.equal(w.storage.get(runtime)!.size, 1); assert.equal(w.flags().claimed, true); assert.equal(w.flags().preload, true);
  w.offline(true); assert.equal(await (await w.request("assets/questions-bank-hash.js"))!.text(), "keep question bank");
});

test("upgrading the old full cache preserves downloaded question banks even when storage is full", async () => {
  for (const quota of [false, true]) {
    const w = worker();
    await (await w.open("upsc-static-previous-release")).put(new URL("./assets/questions-bank-hash.js", scope).href, new Response("existing offline questions"));
    await (await w.open("upsc-static-previous-release")).put(new URL("./assets/obsolete-hash.js", scope).href, new Response("obsolete code"));
    await w.lifecycle("install"); if (quota) w.rejectWrites();
    await w.lifecycle("activate"); w.offline(true);
    assert.equal(await (await w.request("assets/questions-bank-hash.js"))!.text(), "existing offline questions");
    assert.equal(w.fetched.length, 0);
    assert.equal(w.storage.has("upsc-static-previous-release"), quota, "Retain only an immutable asset that could not be moved because storage is full");
  }
});

test("navigation refreshes HTML online and falls back to the shell offline", async () => {
  const w = worker(); await w.lifecycle("install");
  const online = await w.request("./", { mode: "navigate", preloaded: new Response("fresh HTML") });
  assert.equal(await online!.text(), "fresh HTML"); assert.equal(w.fetched.length, 0);
  w.offline(true);
  assert.equal(await (await w.request("./", { mode: "navigate" }))!.text(), "fresh HTML");
  assert.match(await (await w.request("new-page", { mode: "navigate" }))!.text(), /^core:/);
});

test("optional quota failures do not break content requests and APIs stay outside the cache", async () => {
  const w = worker(); await w.lifecycle("install"); w.rejectWrites();
  assert.equal((await w.request("assets/questions-bank-hash.js"))!.status, 200);
  for (const [path, options] of [["auth-config.json", {}], ["./?token_hash=private", { mode: "navigate" }], ["./?code=private", { mode: "navigate" }], ["https://api.example.test/private", {}], ["../other-site/", { mode: "navigate" }], ["api/private", {}], ["assets/app-hash.js", { method: "POST" }]] as const)
    assert.equal(await w.request(path, options), undefined, path);
});
