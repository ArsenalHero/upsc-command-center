import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";

const root = "dist", manifest = JSON.parse(readFileSync(`${root}/build-manifest.json`, "utf8"));
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
function dependencies(roots) {
  const visited = new Set(), files = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key); const chunk = manifest[key]; assert.ok(chunk, `Missing chunk ${key}`);
    files.add(chunk.file); for (const dependency of chunk.imports || []) visit(dependency);
  }
  roots.forEach(visit); return [...files];
}
const initial = dependencies([entry, "src/pages/Dashboard.tsx"]);
const practice = dependencies([entry, "src/pages/Practice.tsx"]);
const mockEntry = Object.keys(manifest).find(key => key === "src/pages/MockLab.tsx" || manifest[key].name === "MockLab" && manifest[key].isDynamicEntry);
assert.ok(mockEntry, "Missing mock exam entry");
const mockExam = dependencies([entry, mockEntry]);
assert.ok(!mockExam.some(file => /MockCharts|ScatterChart|questions-|question-support-/.test(file)), "Timed mock exams eagerly load report charts or question banks");
const offline = JSON.parse(readFileSync(`${root}/sw.js`, "utf8").match(/const FILES=(\[.*?\]);/)[1]);
const size = files => files.reduce((total, file) => total + statSync(`${root}/${file}`).size, 0);
const dashboardBytes = size(initial), offlineBytes = size(offline.filter(file => file !== "./"));
assert.ok(dashboardBytes < 600_000, `Dashboard startup exceeded 600 KB: ${dashboardBytes}`);
assert.ok(offlineBytes < 6_000_000, `Offline startup exceeded 6 MB: ${offlineBytes}`);
assert.ok(!initial.some(file => /DashboardAnalytics|ScatterChart|questions-|question-support-/.test(file)), "The dashboard eagerly loads charts or question banks");
assert.ok(!practice.some(file => /questions-|question-support-/.test(file)), "General practice eagerly loads question banks");
assert.ok(!offline.some(file => /questions-|question-support-/.test(file)), "Offline install eagerly downloads question banks");
for (const file of offline) if (file !== "./") assert.ok(statSync(`${root}/${file}`).isFile(), `Missing offline file ${file}`);
const gzipBytes = initial.reduce((total, file) => total + gzipSync(readFileSync(`${root}/${file}`)).length, 0);
console.log(`Performance budgets passed: dashboard ${(dashboardBytes / 1000).toFixed(1)} KB (${(gzipBytes / 1000).toFixed(1)} KB gzip estimate), ${offline.length} offline files / ${(offlineBytes / 1000000).toFixed(2)} MB, general practice independent of question banks.`);
