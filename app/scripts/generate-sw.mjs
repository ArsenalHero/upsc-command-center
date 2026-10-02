import { readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const assets = readdirSync("dist/assets").map((f) => "./assets/" + f);
const digest = createHash("sha256")
  .update(readFileSync("dist/index.html"))
  .digest("hex")
  .slice(0, 12);
const cache = "upsc-static-" + digest;
const sw = `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(["./", "./index.html", "./favicon.svg", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", ...assets])};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('upsc-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.searchParams.has('token_hash')||u.searchParams.has('code')||u.pathname.endsWith('/auth-config.json'))return;e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>caches.match(e.request).then(cached=>cached||(e.request.mode==='navigate'?caches.match(new URL('./index.html',self.registration.scope).href):new Response('Offline',{status:503})))));});`;
writeFileSync("dist/sw.js", sw);
console.log("Offline shell generated: " + FILESMessage());
function FILESMessage() {
  return assets.length + 6 + " static assets";
}
